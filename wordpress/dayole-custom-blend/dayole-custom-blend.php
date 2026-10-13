<?php
/**
 * Plugin Name: DAYOLE Custom Blend Bridge
 * Description: Preserves AI perfume blend name, components, recipe and size from the DAYOLE storefront in WooCommerce cart and order items.
 * Version: 1.1.0
 * Author: DAYOLE
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
add_filter( 'woocommerce_store_api_add_to_cart_data', function( $add_to_cart_data, $request ) {
    $name = sanitize_text_field( (string) $request->get_param( 'dayole_blend_name' ) );
    $size = sanitize_text_field( (string) $request->get_param( 'dayole_blend_size' ) );
    $reference = sanitize_text_field( (string) $request->get_param( 'dayole_blend_reference' ) );
    $components = $request->get_param( 'dayole_blend_components' );
    $recipe = $request->get_param( 'dayole_blend_recipe' );
    if ( ! $name && empty( $components ) ) return $add_to_cart_data;
    $clean_components = array();
    if ( is_array( $components ) ) foreach ( array_slice( $components, 0, 4 ) as $component ) { $component = sanitize_text_field( (string) $component ); if ( $component !== '' ) $clean_components[] = $component; }
    $clean_recipe = array(); $recipe_total = 0;
    if ( is_array( $recipe ) ) foreach ( array_slice( $recipe, 0, 4 ) as $part ) {
        if ( ! is_array( $part ) ) continue;
        $part_name = sanitize_text_field( (string) ( $part['name'] ?? '' ) );
        $percentage = absint( $part['percentage'] ?? 0 );
        if ( $part_name !== '' && $percentage > 0 && $percentage <= 100 ) { $clean_recipe[] = array( 'name' => mb_substr( $part_name, 0, 120 ), 'percentage' => $percentage ); $recipe_total += $percentage; }
    }
    if ( ! empty( $clean_recipe ) && $recipe_total !== 100 ) $clean_recipe = array();
    $add_to_cart_data['cart_item_data']['dayole_custom_blend'] = array('name'=>mb_substr($name,0,80),'size'=>mb_substr($size,0,30),'components'=>$clean_components,'recipe'=>$clean_recipe,'reference'=>mb_substr($reference,0,100));
    $add_to_cart_data['cart_item_data']['dayole_blend_key'] = md5( wp_json_encode( $add_to_cart_data['cart_item_data']['dayole_custom_blend'] ) );
    return $add_to_cart_data;
}, 10, 2 );
function dayole_recipe_text( $recipe ) { $parts=array(); if(is_array($recipe)) foreach($recipe as $part){if(is_array($part)&&!empty($part['name'])&&!empty($part['percentage']))$parts[]=sanitize_text_field($part['name']).' — '.absint($part['percentage']).'%';} return implode(' + ',$parts); }
add_filter( 'woocommerce_get_item_data', function( $item_data, $cart_item ) {
    if ( empty( $cart_item['dayole_custom_blend'] ) || ! is_array( $cart_item['dayole_custom_blend'] ) ) return $item_data;
    $blend=$cart_item['dayole_custom_blend'];
    if(!empty($blend['name']))$item_data[]=array('key'=>'Custom name','value'=>esc_html($blend['name']));
    if(!empty($blend['components']))$item_data[]=array('key'=>'Blend','value'=>esc_html(implode(' + ',$blend['components'])));
    if(!empty($blend['recipe']))$item_data[]=array('key'=>'Preparation recipe','value'=>esc_html(dayole_recipe_text($blend['recipe'])));
    if(!empty($blend['size']))$item_data[]=array('key'=>'Size','value'=>esc_html($blend['size']));
    return $item_data;
},10,2);
add_action( 'woocommerce_checkout_create_order_line_item', function( $item, $cart_item_key, $values, $order ) {
    if ( empty( $values['dayole_custom_blend'] ) || ! is_array( $values['dayole_custom_blend'] ) ) return;
    $blend=$values['dayole_custom_blend'];
    if(!empty($blend['name']))$item->add_meta_data('Custom perfume name',$blend['name'],true);
    if(!empty($blend['components']))$item->add_meta_data('Blend components',implode(' + ',$blend['components']),true);
    if(!empty($blend['recipe']))$item->add_meta_data('Blend recipe',dayole_recipe_text($blend['recipe']),true);
    if(!empty($blend['size']))$item->add_meta_data('Custom blend size',$blend['size'],true);
    if(!empty($blend['reference']))$item->add_meta_data('DAYOLE blend reference',$blend['reference'],true);
},10,4);
