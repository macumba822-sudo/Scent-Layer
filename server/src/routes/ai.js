import { Router } from 'express';
import { z } from 'zod';
import { structuredCall } from '../services/anthropic.js';
import { aiLimiter } from '../middleware/rate-limit.js';

const router = Router();
router.use(aiLimiter);

const VOICE = `You write fragrance copy for Scent Layer, a sampling and concierge sourcing platform. Customers order 2ml / 5ml / 10ml / 30ml decants before committing to full bottles.

Voice, match this exactly:
- Short sentences. Verb-first when possible.
- Name notes by name (saffron, bergamot, tobacco). Never as categories ("florals", "woods", "spices").
- Specific contexts ("after rain", "with cashmere", "past midnight"). Never abstractions ("moments", "experiences", "journeys").
- Cite real fragrances by name and brand when relevant.
- No exclamation points anywhere.
- No three-word listicles.

When you describe how a fragrance develops, describe what literally happens in literal time instead of using motion verbs as metaphor.
When relevant, gently nudge toward sampling first rather than committing to full bottles blind. Never push purchase, sourcing happens on request.`;

const languageShape = z.enum(['es', 'en']).default('es');
function languageInstruction(language) {
  return language === 'en'
    ? '\n\nOUTPUT LANGUAGE: English. Write every user-facing string value in English. Keep fragrance names and brand names exactly as proper names. Keep the JSON/tool property names unchanged.'
    : '\n\nIDIOMA DE SALIDA: Español. Escribe TODOS los valores de texto visibles para el usuario en español natural, incluidos nombres creativos del blend, etiquetas, notas descriptivas, ocasiones, consejos, explicaciones, veredictos y etiquetas de ranking. Conserva los nombres propios de perfumes y marcas tal como son. No traduzcas las claves/propiedades del JSON o de la herramienta.';
}

const wardrobeShape = z.object({ name: z.string(), brand: z.string(), status: z.enum(['OWNED', 'SAMPLED', 'BACKUP']) });
const reviewShape = z.object({ name: z.string(), brand: z.string(), rating: z.enum(['LOVED', 'LIKED', 'CONFLICT', 'HATED']), text: z.string().max(400).optional() });
const userContextShape = z.object({ wardrobe: z.array(wardrobeShape).max(60).optional(), reviews: z.array(reviewShape).max(40).optional() }).optional();

function formatUserContext(ctx) {
  if (!ctx) return '';
  const parts = [];
  if (ctx.wardrobe?.length) {
    const owned = ctx.wardrobe.filter(w => w.status === 'OWNED');
    const sampled = ctx.wardrobe.filter(w => w.status === 'SAMPLED');
    if (owned.length) parts.push(`This person already owns: ${owned.map(w => `${w.name} (${w.brand})`).join(', ')}. Do NOT recommend any of these.`);
    if (sampled.length) parts.push(`They have sampled: ${sampled.map(w => `${w.name} (${w.brand})`).join(', ')}.`);
  }
  if (ctx.reviews?.length) {
    const loved = ctx.reviews.filter(r => r.rating === 'LOVED');
    const liked = ctx.reviews.filter(r => r.rating === 'LIKED');
    const conflict = ctx.reviews.filter(r => r.rating === 'CONFLICT' || r.rating === 'HATED');
    if (loved.length) parts.push(`They LOVED: ${loved.map(r => `${r.name} (${r.brand})${r.text ? `, "${r.text.slice(0, 120)}"` : ''}`).join('; ')}. Lean into the qualities of these.`);
    if (liked.length) parts.push(`They liked: ${liked.map(r => `${r.name} (${r.brand})`).join(', ')}.`);
    if (conflict.length) parts.push(`These did NOT work on their skin: ${conflict.map(r => `${r.name} (${r.brand})`).join(', ')}. Avoid recommending fragrances with very similar profiles.`);
  }
  if (!parts.length) return '';
  return `\n\nPERSONAL CONTEXT:\n${parts.join('\n')}\n`;
}

const fragranceShape = z.object({ name: z.string(), brand: z.string(), family: z.string(), top: z.string(), heart: z.string(), base: z.string() });

router.post('/layer', async (req, res, next) => {
  try {
    const { fragrances, userContext, language } = z.object({ fragrances: z.array(fragranceShape).min(2).max(4), userContext: userContextShape, language: languageShape }).parse(req.body);
    const list = fragrances.map((f, i) => `${i + 1}. ${f.name}, ${f.brand} (${f.family})\n   Top: ${f.top}\n   Heart: ${f.heart}\n   Base: ${f.base}`).join('\n\n');
    const result = await structuredCall({
      system: VOICE,
      user: `Analyze how these ${fragrances.length} fragrances layer together when worn on the same skin:\n\n${list}\n${formatUserContext(userContext)}\nReturn the analysis in the structured tool call.${languageInstruction(language)}`,
      toolName: 'layer_analysis', maxTokens: 1024,
      schema: { type: 'object', properties: {
        blendName: { type: 'string' }, tags: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 }, character: { type: 'string' },
        topNotes: { type: 'string' }, heartNotes: { type: 'string' }, baseNotes: { type: 'string' }, occasions: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
        tip: { type: 'string' }, reasoning: { type: 'string' }
      }, required: ['blendName','tags','character','topNotes','heartNotes','baseNotes','occasions','tip','reasoning'] }
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/compare', async (req, res, next) => {
  try {
    const { fragrances, userContext, language } = z.object({ fragrances: z.array(fragranceShape).min(2).max(4), userContext: userContextShape, language: languageShape }).parse(req.body);
    const labels = ['A','B','C','D'];
    const lineup = fragrances.map((f,i) => `${labels[i]}) ${f.name}, ${f.brand} (${f.family})\n   Top: ${f.top}\n   Heart: ${f.heart}\n   Base: ${f.base}`).join('\n\n');
    const isMulti = fragrances.length > 2;
    const prompt = isMulti
      ? `Compare these ${fragrances.length} fragrances for someone choosing among them:\n\n${lineup}\n${formatUserContext(userContext)}\nWrite one 5-7 sentence paragraph naming each fragrance, contrasting what each does best, and ending with concrete guidance. No bullet points.`
      : `Compare these two fragrances for someone deciding between them:\n\n${lineup}\n${formatUserContext(userContext)}\nWrite one 4-6 sentence verdict naming each fragrance, contrasting what they do best, and ending with concrete guidance. No bullet points.`;
    const result = await structuredCall({ system: VOICE, user: `${prompt}${languageInstruction(language)}`, toolName: 'compare_verdict', maxTokens: 800,
      schema: { type: 'object', properties: { verdict: { type: 'string' }, reasoning: { type: 'string' } }, required: ['verdict','reasoning'] } });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/similar', async (req, res, next) => {
  try {
    const { fragrance, userContext, language } = z.object({ fragrance: z.string().min(2).max(120), userContext: userContextShape, language: languageShape }).parse(req.body);
    const result = await structuredCall({ system: VOICE,
      user: `Someone loves the fragrance "${fragrance}". Recommend exactly 3 alternative fragrances that share its DNA. Mix tiers: one obvious crowd-pleaser, one understated niche option, one ambitious next-level pick. For each, name the actual brand and fragrance, explain the connection in 2-3 sentences, and call out the specific shared notes or qualities.${formatUserContext(userContext)}${languageInstruction(language)}`,
      toolName: 'similar_recommendations', maxTokens: 900,
      schema: { type: 'object', properties: { recommendations: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', properties: { name: {type:'string'}, brand:{type:'string'}, rank:{type:'string'}, why:{type:'string'}, match:{type:'string'} }, required:['name','brand','rank','why','match'] } }, reasoning:{type:'string'} }, required:['recommendations','reasoning'] }
    });
    res.json(result);
  } catch (err) { next(err); }
});

const catalogShape = z.array(z.object({ id:z.number().int(), name:z.string(), brand:z.string(), family:z.string(), top:z.string().optional(), heart:z.string().optional(), base:z.string().optional() })).min(1).max(120);

router.post('/describe', async (req, res, next) => {
  try {
    const { description, catalog, userContext, language } = z.object({ description:z.string().min(8).max(600), catalog:catalogShape, userContext:userContextShape, language:languageShape }).parse(req.body);
    const list = catalog.map(f => `[id:${f.id}] ${f.name}, ${f.brand} (${f.family}) | top: ${f.top || '?'} | heart: ${f.heart || '?'} | base: ${f.base || '?'}`).join('\n');
    const result = await structuredCall({ system: VOICE,
      user: `Someone described a fragrance they smelled, or want to smell, like this:\n\n"${description}"\n\nPick the THREE closest matches from the catalog below. Match on note overlap, structural similarity, mood, and what the description literally says. ONLY pick from the catalog and return the exact id, name, and brand.\n\nCATALOG:\n${list}${formatUserContext(userContext)}${languageInstruction(language)}`,
      toolName:'describe_matches', maxTokens:1100,
      schema:{ type:'object', properties:{ matches:{ type:'array', minItems:3, maxItems:3, items:{ type:'object', properties:{ id:{type:'integer'}, name:{type:'string'}, brand:{type:'string'}, rank:{type:'string'}, why:{type:'string'}, match:{type:'string'} }, required:['id','name','brand','rank','why','match'] } }, reasoning:{type:'string'} }, required:['matches','reasoning'] }
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/wardrobe-insight', async (req, res, next) => {
  try {
    const { wardrobe, reviews, catalog, language } = z.object({ wardrobe:z.array(wardrobeShape).min(1).max(60), reviews:z.array(reviewShape).max(40).optional(), catalog:z.array(z.object({id:z.number().int(),name:z.string(),brand:z.string(),family:z.string()})).min(1).max(120), language:languageShape }).parse(req.body);
    const ownedIds = new Set(wardrobe.filter(w=>w.status!=='BACKUP').map(w=>`${w.name}|${w.brand}`));
    const candidates = catalog.filter(f=>!ownedIds.has(`${f.name}|${f.brand}`));
    const wardrobeList = wardrobe.map(w=>`${w.name} (${w.brand}) [${w.status}]`).join('\n');
    const reviewList = (reviews||[]).map(r=>`${r.name} (${r.brand}) ${r.rating}`).join('\n');
    const candidateList = candidates.slice(0,80).map(f=>`[id:${f.id}] ${f.name} (${f.brand}) ${f.family}`).join('\n');
    const result = await structuredCall({ system:VOICE,
      user:`Read this person's fragrance wardrobe and tell them what it says about their taste, then suggest ONE contrast pick from the catalog they don't already own.\n\nWARDROBE:\n${wardrobeList}\n\n${reviewList ? `PAST REVIEWS:\n${reviewList}\n\n` : ''}NOT-YET-OWNED CATALOG:\n${candidateList}${languageInstruction(language)}`,
      toolName:'wardrobe_insight', maxTokens:700,
      schema:{type:'object',properties:{reading:{type:'string'},contrast:{type:'object',properties:{id:{type:'integer'},name:{type:'string'},brand:{type:'string'},why:{type:'string'}},required:['id','name','brand','why']}},required:['reading','contrast']}
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/quiz', async (req, res, next) => {
  try {
    const { questions, answers, userContext, language } = z.object({ questions:z.array(z.string()).min(3).max(8), answers:z.array(z.string()).min(3).max(8), userContext:userContextShape, language:languageShape }).parse(req.body);
    const pairs = questions.map((q,i)=>`Q${i+1}: ${q}\n→ ${answers[i] ?? '(skipped)'}`).join('\n\n');
    const result = await structuredCall({ system:VOICE,
      user:`Based on these quiz answers, recommend ONE primary signature fragrance plus three meaningful alternatives. Pick real, well-known fragrances. Make the primary description directly reference their answers and do not repeat the primary in the alternates.\n\n${pairs}${formatUserContext(userContext)}${languageInstruction(language)}`,
      toolName:'quiz_recommendation', maxTokens:1200,
      schema:{type:'object',properties:{name:{type:'string'},brand:{type:'string'},description:{type:'string'},tags:{type:'array',items:{type:'string'},minItems:3,maxItems:5},why:{type:'string'},alternates:{type:'array',minItems:3,maxItems:3,items:{type:'object',properties:{name:{type:'string'},brand:{type:'string'},why:{type:'string'},match:{type:'string'}},required:['name','brand','why','match']}},reasoning:{type:'string'}},required:['name','brand','description','tags','why','alternates','reasoning']}
    });
    res.json(result);
  } catch (err) { next(err); }
});

export default router;