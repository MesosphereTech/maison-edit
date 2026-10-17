/**
 * AI-authored, locally rendered retail-concierge dialogue for this fictional demo.
 * No provider request, inferred ownership, real stock claim, or fitting prediction.
 * Editorial observations are separate from live-in-the-demo catalog/variant facts.
 * All functions are pure: callers own persistence, rate limits, and UI actions.
 */
import { catalog, byId, money } from "./data.js";
import {
  sanitizePurchaseHistory,
  buildCatalogOutfit,
  clothingDepartmentFor,
  isOppositeClothingDepartment,
} from "./purchase-history.js";
import {
  curatedScenarioFor,
  personalizedSceneFor,
} from "./personalized-scenes.js";
import { personaPresets, homePresets } from "./presets.js";

const copy = (zh, en) => ({ zh, en });
const entry = (
  initial,
  dwell,
  revisit,
  click,
  pairing,
  consider,
  companions,
  compareId = null,
) => ({
  browsing: { initial, dwell, revisit, click },
  followUps: { pairing, consider },
  companions,
  compareId,
});

/** Four distinct browsing moments and two editorial follow-ups for every SKU.
 * These lines deliberately avoid frozen price/variant/history/stock assertions.
 * Use render helpers below instead of concatenating unvalidated external state.
 */
export const dialogueBank = {
  "ME-001": entry(
    copy(
      "这件西装的重点是肩线放松、腰部收拢。一套里只保留这一处结构感，就很有精神。",
      "This jacket balances a relaxed shoulder with a shaped waist. Let that be the one structured element in the outfit.",
    ),
    copy(
      "可以把注意力放在开襟时的线条：里面越简洁，西装的轮廓越清楚。",
      "Look at the line when the jacket is open. A simple layer underneath lets its shape do the work.",
    ),
    copy(
      "再看这件时，不妨想想你想穿它去哪里：日常通勤，还是需要稍正式的一天？两种搭法不用买齐一整套。",
      "Coming back to this one? Think about the day you need it for: an ordinary workday or something a little more formal. Neither needs a whole new wardrobe.",
    ),
    copy(
      "可以先试西装单穿的比例，再决定要不要成套。肩部活动和里面能叠几层，比只看尺码字母更有参考。",
      "Start by considering the jacket on its own before choosing a suit. Shoulder movement and room for layers matter more than the size letter alone.",
    ),
    copy(
      "配直筒裤会延续长线条；配垂坠衬衫则让上半身轻一点。两件作用不同，先补你真正缺的那一件。",
      "Straight trousers continue the long line; a draped shirt lightens the top half. They do different jobs, so start with whichever is genuinely missing.",
    ),
    copy(
      "到店可重点比较开襟和扣合后的腰线，再抬手、坐下看看。目录轮廓好看，并不等于上身一定合适。",
      "In a fitting, compare the waist open and buttoned, then raise your arms and sit. A promising catalog silhouette still needs a real try-on.",
    ),
    ["ME-003", "ME-002", "ME-007", "ME-004"],
    "ME-012",
  ),
  "ME-002": entry(
    copy(
      "这件衬衫靠垂坠感留住轻松，不需要再加太多装饰。和有结构的外套放在一起会更有层次。",
      "The drape keeps this shirt easy. It needs little decoration, especially beside a more structured jacket.",
    ),
    copy(
      "如果想穿得利落，可以先看半掖或全掖的效果；想松弛些，就让衣摆自然落下。",
      "For a sharper line, consider a half tuck or full tuck. Leaving the hem loose gives a more relaxed direction.",
    ),
    copy(
      "如果还惦记这件，值得问的是：你缺的是内搭，还是一件能单穿的衬衫？用途明确了，才好选。",
      "If this is still on your mind, is it a layer you need or a shirt to wear on its own? That distinction makes the decision easier.",
    ),
    copy(
      "它是宽松、垂坠的方向。试穿时可以一起看看领口、袖口和坐下后的衣摆，不急着往小一码选。",
      "This is a loose, draped direction. Check the neckline, cuffs and hem when seated rather than automatically sizing down.",
    ),
    copy(
      "下装可以选直筒羊毛裤，让柔软和挺括各占一半；晚一点的场合再换缎面裙。",
      "Straight wool trousers balance softness with structure. A satin skirt takes the same shirt toward the evening.",
    ),
    copy(
      "喜欢的是光泽还是垂感？如果更在意挺括线条，可以和目录里的棉质衬衫比较；两件的材质与部门不同。",
      "Is it the sheen or the drape you like? For a crisper direction, compare the catalog cotton shirt, remembering it belongs to a different department.",
    ),
    ["ME-003", "ME-001", "ME-005", "ME-007"],
    "ME-010",
  ),
  "ME-003": entry(
    copy(
      "高腰加直筒，是这条裤子的主线。上装不必也很正式，一件简洁针织就能把它带回日常。",
      "A high waist and straight leg lead here. The top needn’t be equally formal; a simple knit brings the trousers into everyday use.",
    ),
    copy(
      "看裤装时，我会先分开考虑腰部和裤长。两处都要试，不能只用常穿尺码替代。",
      "I’d consider the waist and length separately. Both need checking rather than relying only on your usual size.",
    ),
    copy(
      "这条如果已经接近你的日常需求，可以先围绕现有上装搭一次，不用为了“成套”加买。",
      "If these feel close to what you need, first build an outfit with tops you already have. A matching set is optional.",
    ),
    copy(
      "试穿时可以带常穿的鞋，看看裤脚落点；再坐下确认腰部，决定会更具体。",
      "Bring the shoes you normally wear to check the hem, then sit down to assess the waist. That makes the choice more concrete.",
    ),
    copy(
      "松一点的针织与利落衬衫都能接上这条裤子：前者偏日常，后者更适合需要收拾精神的时刻。",
      "An easy knit makes these everyday trousers; a clean shirt gives them a more dressed-up purpose.",
    ),
    copy(
      "可以用同色西装外套衔接这条裤子，也可以换一件柔软针织，让整体更轻松。",
      "Pair these trousers with a tonal jacket, or soften the look with an easy knit.",
    ),
    ["ME-001", "ME-002", "ME-006", "ME-007"],
    "ME-011",
  ),
  "ME-004": entry(
    copy(
      "弧线和哑光五金，让这只包有轮廓但不过分抢眼。衣服越简单，它越能成为一个小重点。",
      "The curved shape and matte hardware give this bag presence without much fuss. Simple clothes leave it room to be the accent.",
    ),
    copy(
      "比起先加耳饰、腰带和鞋，不如只留这只包做重点，看看整套是不是已经够了。",
      "Before adding earrings, a belt and special shoes, let the bag be the only accent and see whether that’s enough.",
    ),
    copy(
      "再看包时，值得想一下你每天真正带什么。外形喜欢是一回事，收纳是否合用要另看。",
      "On a second look, think about what you actually carry each day. Liking the shape and finding it practical are separate questions.",
    ),
    copy(
      "可以到店核对开口、背带和日常物品的收纳；目录没有给出容量，不能凭图片判断能装下多少。",
      "Check the opening, strap and your daily essentials in person. The catalog gives no capacity, so the image can’t settle what will fit.",
    ),
    copy(
      "搭西装时，它用曲线缓和直线；搭针织和裙装时，则把柔和的组合收住。",
      "With tailoring, the curve softens the straight lines. With knitwear and a skirt, the bag gives the softer look a clear finish.",
    ),
    copy(
      "如果只是想找日常随手用的包，也可以比较帆布款。先看用途，再看价差，不必把两种材质当作同一体验。",
      "For an everyday carry, compare the canvas bag too. Start with the use, then the price; the two materials won’t give the same experience.",
    ),
    ["ME-001", "ME-002", "ME-005", "ME-006"],
    "ME-027",
  ),
  "ME-005": entry(
    copy(
      "缎面裙本身已有光泽，上身换成朴素针织，往往比再加亮面更从容。",
      "The satin already brings a sheen. A plain knit above it can feel easier than adding another glossy surface.",
    ),
    copy(
      "可以留意裙摆的流动线条，再用平底鞋想象一下日常版本；不一定要留给晚间。",
      "Notice the movement of the hem, then imagine it with flats. This needn’t be saved only for the evening.",
    ),
    copy(
      "如果担心太正式，先把它和最简单的上装放在一起看。问题可能在搭法，不一定在裙子。",
      "If it feels too dressed up, consider it with your simplest top first. The styling may be the issue rather than the skirt.",
    ),
    copy(
      "到店值得看自然光下的光泽、坐下后的腰部，以及走动时裙摆的变化。",
      "In person, check the sheen in natural light, the waist when seated and the way the hem moves as you walk.",
    ),
    copy(
      "针织加缎面，是质感上的一软一亮。配饰先减到一件，给裙摆留一点空间。",
      "Knitwear and satin give a soft-and-smooth contrast. Keep accessories to one accent so the skirt has some breathing room.",
    ),
    copy(
      "想更省心地形成完整轮廓，可以比较长裙；想和多件上装轮换，这条半裙更值得细看。",
      "For a one-piece silhouette, compare the dress. If rotating several tops is the priority, look more closely at this skirt.",
    ),
    ["ME-006", "ME-026", "ME-002", "ME-007"],
    "ME-015",
  ),
  "ME-006": entry(
    copy(
      "这件细密针织可以做一套里的柔和底层。和缎面或羊毛裤搭，变化主要来自下装。",
      "This fine knit can be the soft base of an outfit. A satin skirt or wool trousers changes the mood underneath it.",
    ),
    copy(
      "如果已有相近的针织，先比较领口、厚薄需求和你会搭的下装，再决定是否需要另一件。",
      "If you already have a similar knit, compare the neckline, the weight you need and the bottoms you’d wear it with before adding another.",
    ),
    copy(
      "又看回这件的话，可以先想一套明天就会穿的组合。能落到具体日子，比单看“百搭”更有用。",
      "If you’re returning to it, picture an outfit you’d actually wear tomorrow. A specific day is more useful than a vague idea of versatility.",
    ),
    copy(
      "可以试试单穿和套在外套里的状态，再确认领口与袖部。目录说适合叠穿，实际余量仍要试。",
      "Try it alone and under a jacket, checking the neck and sleeves. The catalog suggests layering, but the space still needs a fitting.",
    ),
    copy(
      "和直筒裤是安静的日常组合；换成缎面裙，光泽反差会更明显。不必同时添两件下装。",
      "Straight trousers make a quiet everyday outfit; satin brings more textural contrast. There’s no need to add both bottoms.",
    ),
    copy(
      "如果你只是想给中性色衣橱添一个变化，可以比较细羊毛圆领衫；如果是补柔软底层，再细看这件。",
      "If the goal is a change in a neutral wardrobe, compare the wool crewneck. If you need a soft base layer, stay with this one a little longer.",
    ),
    ["ME-003", "ME-005", "ME-001", "ME-007"],
    "ME-026",
  ),
  "ME-007": entry(
    copy(
      "简洁鞋头的平底鞋，可以让裙装少一点郑重，也能接住直筒裤的利落。",
      "A simple-toed flat can make a skirt feel less formal while keeping the clean line of straight trousers.",
    ),
    copy(
      "鞋子我会把试穿放在第一位：鞋面看起来柔软，不代表走路就一定舒服。",
      "For shoes, I’d put the fitting first. A soft-looking upper doesn’t guarantee comfort when walking.",
    ),
    copy(
      "若你已经有常穿平底鞋，不妨先问这双补的是颜色、场合，还是一双确实需要替换的旧鞋。",
      "If you already have everyday flats, is this adding a colour, covering an occasion or replacing a worn pair? That helps clarify the choice.",
    ),
    copy(
      "当前目录只提供演示规格，没有真实鞋码。到店还要核对鞋码、脚背和走动感受。",
      "This catalog only has demo options, not real shoe sizing. Confirm the shoe size, instep and walking feel in person.",
    ),
    copy(
      "配缎面裙会收得轻一些；配羊毛裤则让整套保持简洁，袜口和裤脚可以一起试。",
      "With a satin skirt these keep the finish light; with wool trousers they keep things simple. Check the sock and hem together.",
    ),
    copy(
      "和麂皮便鞋相比，先比较你要的轮廓，再谈价格。两双都需要真实试穿，不能从图里替你判断舒适度。",
      "Against the suede loafer, start with the silhouette you want, then compare prices. Neither image can tell us which will feel better on your feet.",
    ),
    ["ME-003", "ME-005", "ME-015", "ME-006"],
    "ME-013",
  ),
  "ME-008": entry(
    copy(
      "这副耳饰的线条已经有雕塑感。衣领干净些，就不用再叠很多装饰。",
      "The sculptural line gives these earrings their own presence. A clean neckline leaves little need for extra decoration.",
    ),
    copy(
      "小面积的金属感适合做收尾，先和你常戴的饰品比较一下，不急着凑一整套。",
      "A small metallic accent can finish a look. Compare it with the jewelry you normally wear before building a whole set.",
    ),
    copy(
      "再看耳饰时，可以想想你会搭的领口和发型。它们比单独看一张产品图更影响整体。",
      "On another look, think about the necklines and hairstyle you’d wear with them. Those shape the overall effect more than the product image alone.",
    ),
    copy(
      "到店可核对佩戴结构、重量感和实际表面。目录的镀金色泽只是视觉示例。",
      "In person, check the fastening, perceived weight and finish. The catalog’s gold-toned appearance is a visual example.",
    ),
    copy(
      "让针织或衬衫保持简洁，耳饰就能成为唯一的小亮点；包和腰带可以先不加。",
      "Keep the knit or shirt simple and let the earrings be the one small highlight. The bag and belt can wait.",
    ),
    copy(
      "如果你不常戴耳饰，也不必为了完整搭配买下它。保留干净领口，本身就是一种完成。",
      "If earrings aren’t something you wear often, there’s no need to buy them to complete a look. A clean neckline can already feel finished.",
    ),
    ["ME-002", "ME-005", "ME-006", "ME-015"],
  ),
  "ME-009": entry(
    copy(
      "这件长外套以长线条为主，里面可以更简洁。先把大衣当重点，不必让每一层都出声。",
      "The long line leads this coat. Keep the layers underneath simple and let the outer shape carry the outfit.",
    ),
    copy(
      "外套看起来松弛，也要试里面加针织后的肩部和手臂活动。叠穿空间不能只凭照片判断。",
      "An easy-looking coat still needs checking over knitwear, especially at the shoulders and arms. A photo can’t establish layering room.",
    ),
    copy(
      "如果还在比较长短外套，先想常穿的下装和出行方式。长线条和短版的作用不一样。",
      "If you’re weighing long and short outerwear, think about your usual bottoms and daily journeys. The two lengths do different jobs.",
    ),
    copy(
      "到店可以用你平时的针织试套一次，开襟和扣合都看。是否挡风、保暖，目录没有充分依据。",
      "Try it over your usual knit, open and fastened. The catalog doesn’t establish wind protection or real-world warmth.",
    ),
    copy(
      "里面用衬衫和直筒裤延续纵向线条，或用针织和半裙柔化一点；先选你常用的那一路。",
      "A shirt and straight trousers continue the vertical line; a knit and skirt soften it. Start with the direction you’d use most.",
    ),
    copy(
      "短版风衣可以作为比例和预算上的比较项，但材质与用途不同，不把它当作这件大衣的等价替代。",
      "The cropped trench offers a different proportion and price, but its material and purpose differ. It isn’t an equivalent replacement.",
    ),
    ["ME-003", "ME-002", "ME-006", "ME-005"],
    "ME-025",
  ),
  "ME-010": entry(
    copy(
      "这件立领衬衫走挺括、干净的方向。和有褶的长裤放在一起，细节已经足够。",
      "This stand-collar shirt takes a crisp, clean direction. With pleated trousers, there’s already enough detail.",
    ),
    copy(
      "不想太正式，可以把外层换成针织，或不加西装；先看领口和裤腰之间的比例。",
      "For a less formal outfit, use knitwear rather than a jacket, or skip the outer layer. Look at the balance from collar to waistband.",
    ),
    copy(
      "再看这件时，可以用你最常穿的裤子作为标准：是需要一件更利落的上装，还是已经有相近款？",
      "Compare it against the trousers you wear most. Do you need a crisper top, or is something similar already doing the job?",
    ),
    copy(
      "试穿可以看领口、抬手后的衣摆和坐下时的前襟。常穿尺码只是起点。",
      "Check the collar, the hem with arms raised and the front when seated. Your usual size is only a starting point.",
    ),
    copy(
      "配双褶长裤是一条清楚的通勤路线；需要更完整时再加轻结构西装，鞋子先用常穿的。",
      "Pleated trousers make a clear workday combination. Add the lightly structured jacket only if needed, and start with shoes you already use.",
    ),
    copy(
      "若想要的是柔和层次，可以和罗纹针织比较。衬衫强调挺括，针织强调纹理，并非谁更正式就更好。",
      "For a softer layer, compare the rib knit. The shirt offers crispness, the knit offers texture; neither is automatically the better choice.",
    ),
    ["ME-011", "ME-012", "ME-013", "ME-014"],
    "ME-014",
  ),
  "ME-011": entry(
    copy(
      "双褶给这条裤子增加了结构。上身用简洁衬衫或针织，不需要更多复杂细节。",
      "The double pleats give these trousers their structure. A simple shirt or knit is enough above them.",
    ),
    copy(
      "可以特别看腰部、褶线和坐下后的状态；“活动空间”是目录方向，仍要用实际试穿确认。",
      "Pay attention to the waist, pleats and seated shape. The catalog suggests room to move, but that still needs trying.",
    ),
    copy(
      "如果这一条会是常穿裤，值得先和现有两件上装各搭一次，再考虑是否需要外套。",
      "If these would become regular trousers, try them with two existing tops before deciding whether a new jacket is needed.",
    ),
    copy(
      "到店可带常穿鞋讨论裤脚落点，是否改裤长及费用需要另行确认。",
      "Bring your usual shoes to discuss the hem. Any alteration service and cost would need separate confirmation.",
    ),
    copy(
      "衬衫让线条更清楚，罗纹针织让日常感多一点。两种都可以从现有上装开始。",
      "A shirt makes the line sharper; a rib knit makes it easier for everyday wear. Start with tops you already have.",
    ),
    copy(
      "可以试试同色西装的利落感，也可以用针织上衣搭出更轻松的层次。",
      "Try a tonal jacket for a sharper look, or add a knit for a more relaxed layer.",
    ),
    ["ME-010", "ME-014", "ME-012", "ME-013"],
    "ME-003",
  ),
  "ME-012": entry(
    copy(
      "轻结构西装适合把整套收得利落一点，里面不一定要衬衫，针织也是一条方向。",
      "A lightly structured jacket can pull an outfit together. A knit underneath is an option, not only a shirt.",
    ),
    copy(
      "可以先看敞开穿时的线条，再看扣合。比起凑套装，先确认你会怎样穿这件。",
      "Look at it open before buttoned. Before building a suit, work out how you’d actually use the jacket.",
    ),
    copy(
      "如果反复比较的是西装和针织，可能要先分清：你缺一件外层，还是日常上装？",
      "If you keep comparing this with knitwear, first separate the needs: an outer layer or an everyday top?",
    ),
    copy(
      "到店建议在里面试两种厚度的上装，检查肩部、胸前和手臂活动，不直接按人物示例判定尺码。",
      "Try two layer weights underneath and check the shoulders, chest and arm movement. A persona example can’t determine the size.",
    ),
    copy(
      "双褶长裤可以延续剪裁感；里面放一件简单衬衫，或用罗纹针织把整体放松。",
      "Pleated trousers continue the tailored direction. Use a simple shirt inside, or a rib knit for an easier mood.",
    ),
    copy(
      "和另一件女装西装只能比较轮廓方向与价差，不能据此替你换部门或判断哪件更合身。",
      "The womenswear blazer can be compared for silhouette and price, but that doesn’t justify changing departments or predicting a better fit.",
    ),
    ["ME-011", "ME-010", "ME-014", "ME-013"],
    "ME-001",
  ),
  "ME-013": entry(
    copy(
      "这双便鞋的无装饰轮廓很克制，适合在裤装下面留一个安静的收尾。",
      "The unadorned shape keeps these loafers quiet. They can give trousers a simple finish.",
    ),
    copy(
      "鞋子的关键还是脚感。先看鞋口、脚背与走动，不因为麂皮看起来柔和就跳过试穿。",
      "The important part is still how they feel. Check the opening, instep and walking feel rather than assuming the suede will be comfortable.",
    ),
    copy(
      "如果已经有常穿便鞋，这双需要有一个明确用途：替换旧鞋，或补一套现有衣服。",
      "If you already have regular loafers, give this pair a clear job: replacing worn shoes or serving an existing outfit.",
    ),
    copy(
      "到店试穿时，可以留意脚趾的活动空间、后跟贴合感和走动的舒适度。",
      "When trying them in store, notice the toe room, heel comfort and how they feel as you walk.",
    ),
    copy(
      "配双褶长裤时，可以把裤脚和鞋面一起看；上身衬衫或针织都不必太复杂。",
      "With pleated trousers, consider the hem against the shoe. Keep the shirt or knit above it uncomplicated.",
    ),
    copy(
      "想比较另一种鞋型，可以看芭蕾平底鞋；它是轮廓上的另一条路，不能代替真实脚感比较。",
      "For another silhouette, compare the ballet flat. It’s a different visual direction, not a substitute for comparing the fit on your feet.",
    ),
    ["ME-011", "ME-010", "ME-014", "ME-012"],
    "ME-007",
  ),
  "ME-014": entry(
    copy(
      "细罗纹给这件针织一点纹理，整套衣服就不必都靠颜色制造变化。",
      "The fine rib adds texture, so the rest of the outfit needn’t rely on colour for interest.",
    ),
    copy(
      "可以把它当作日常上装来看，下面用直线条长裤；先不加外套，也能把轮廓看清。",
      "Consider it first as an everyday top with straight-lined trousers. You can assess the shape before adding a jacket.",
    ),
    copy(
      "若你想要的是穿着放松、看着整洁，这件值得和衬衫各搭一次裤子；两种结果会很不同。",
      "For an easy but tidy direction, compare this and a shirt with the same trousers. The two will give quite different results.",
    ),
    copy(
      "到店可以核对罗纹的贴身程度和里面要不要加内搭。图里的松紧感不能当成实际合身结论。",
      "Check how close the rib sits and whether you want an underlayer. The image can’t establish the actual fit.",
    ),
    copy(
      "双褶长裤给下半身一点结构，麂皮便鞋作收尾；如果这两样已在记录里，就只评估这件上装。",
      "Pleated trousers add structure below, with suede loafers to finish. If those are already in the history, assess only whether this top is needed.",
    ),
    copy(
      "如果想更利落些，比较立领棉衬衫；想保留纹理和柔和线条，再留在这件针织上。",
      "For a crisper direction, compare the stand-collar cotton shirt. Stay with the knit if texture and softer lines are the priority.",
    ),
    ["ME-011", "ME-013", "ME-012", "ME-010"],
    "ME-010",
  ),
  "ME-015": entry(
    copy(
      "长裙的自然纹理已经有表情，鞋和包可以简单一点，让整体保留松弛。",
      "The dress has expression in its natural texture. Simple shoes and a bag can keep the whole look easy.",
    ),
    copy(
      "不用急着加腰带。先看长裙原本的直线比例，再决定你是否真的想强调腰线。",
      "There’s no rush to add a belt. Look at the original column line first, then decide whether you want a defined waist.",
    ),
    copy(
      "如果这件让你想到一个具体场合，可以先用现有鞋包搭一套；一条长裙未必要带来一串新购买。",
      "If a particular occasion comes to mind, first try the dress with existing shoes and a bag. One dress needn’t lead to a string of purchases.",
    ),
    copy(
      "到店重点看肩部、坐下与走动时的状态。留意喜欢的裙长与穿着的舒适感。",
      "Check the shoulders and the shape when sitting and walking. Look for a length you enjoy and a comfortable feel.",
    ),
    copy(
      "平底鞋会让它更日常，窄腰带是可选变化；先看不加配饰的样子，再决定要不要加。",
      "Flats take it toward everyday use; a narrow belt is an optional change. Start without accessories, then decide.",
    ),
    copy(
      "如果想增加上装轮换，可以比较缎面半裙；如果喜欢一件就有完整轮廓的轻松，继续看长裙。",
      "Compare the satin skirt if you want to rotate different tops. Stay with the dress if a single-piece silhouette is the appeal.",
    ),
    ["ME-007", "ME-016", "ME-027", "ME-008"],
    "ME-005",
  ),
  "ME-016": entry(
    copy(
      "窄腰带更适合做一点线条提示，不必把腰部变成整套的中心。",
      "A narrow belt can suggest a waistline without making it the centre of the outfit.",
    ),
    copy(
      "如果衣服本来的线条已经完整，先试不加腰带。配饰也可以是减法。",
      "If the clothes already have a clear line, try them without the belt first. Accessories can be an exercise in editing.",
    ),
    copy(
      "回来看腰带时，最好带着一件明确想搭的衣服；否则很容易变成“可能用得上”。",
      "On a second look, have a particular garment in mind. Otherwise a belt can easily become something you might use someday.",
    ),
    copy(
      "到店时可以试一下腰带长度与孔位，搭配常穿的裤装比较整体比例。",
      "Try the belt length and fastening positions with your usual trousers to compare the proportions.",
    ),
    copy(
      "可先在长裙外试一下，或核对裤子的腰袢宽度。两种用途，对长度和位置的要求并不一样。",
      "Try it over the dress or check the belt-loop width on trousers. Those uses call for different lengths and placement.",
    ),
    copy(
      "它是点缀，不是完成一套必须补齐的部件。若你不常用腰带，可以把这笔预算留下。",
      "It’s an accent, not a required piece of a complete outfit. If you rarely use belts, keep the budget for something you will use.",
    ),
    ["ME-003", "ME-011", "ME-015", "ME-002"],
  ),
  "ME-017": entry(
    copy(
      "这把椅子的弧线可以做阅读角的主角。先留空一些，比一开始就把周边小物配满更好判断。",
      "The chair’s curves can lead a reading corner. Leave some space around it before filling the scene with smaller objects.",
    ),
    copy(
      "看单椅时，先问能不能保留通道，再看灯和边几放哪里。效果图不能代替实际尺寸。",
      "For a chair, check circulation before placing a lamp or side table. A room image can’t replace measurements.",
    ),
    copy(
      "如果你还在惦记这个阅读角，可以先列出真正缺的功能：坐、放杯子，还是阅读照明？不必一起添齐。",
      "If you’re still thinking about this reading corner, list the missing function: a seat, somewhere for a cup or reading light. They needn’t all be new.",
    ),
    copy(
      "到店可实际坐一坐，再核对椅宽、椅深、搬入路线。页面没有足够尺寸信息，暂不替你判断放得下。",
      "Sit in it and check the width, depth and delivery path. The page doesn’t provide enough dimensions to say it will fit.",
    ),
    copy(
      "边几负责顺手放物，阅读灯负责光线，靠垫只是可选软化。先补功能，再考虑装饰。",
      "A side table gives you a surface, a reading lamp addresses light and a cushion is optional softness. Start with function, then decoration.",
    ),
    copy(
      "房间若已经紧凑，可以先改用靠垫或灯调整角落，不一定需要再放一把椅子。",
      "In a compact room, a cushion or lamp may be enough to change the corner. Another chair isn’t automatically necessary.",
    ),
    ["ME-019", "ME-021", "ME-020", "ME-022"],
  ),
  "ME-018": entry(
    copy(
      "这只花器的起伏表面适合近看。单枝或空放都可以，旁边留一点空白更容易看见形状。",
      "The uneven surface rewards a closer look. Try a single stem or leave it empty, with space around the form.",
    ),
    copy(
      "如果台面已经有很多小物，先移走一两件再想摆放。新花器不一定需要更多陪衬。",
      "If the surface is already busy, remove one or two objects before planning its place. A new vessel may need less company, not more.",
    ),
    copy(
      "再看这只时，可以先选定一个摆放位置；有明确位置，才容易判断是不是重复了一种功能。",
      "On another look, choose a specific surface for it. A clear location helps you judge whether it repeats something you already use.",
    ),
    copy(
      "到店可以看口径、底部和表面，是否适合盛水也要确认。目录没有列出相关使用规格。",
      "Check the opening, base and surface in person. Confirm whether it is suitable for water; the catalog doesn’t specify that.",
    ),
    copy(
      "和圆边几搭时，花器可以是唯一的陈列；如果用托盘归拢小物，就别把整个台面排满。",
      "On the round side table, the vessel can be the only display. If a tray gathers other objects, keep some of the surface clear.",
    ),
    copy(
      "若家里已有类似花器，先试换个位置或少放一点花。无需买第二只才能看到变化。",
      "If you already have a similar vessel, try a different position or fewer stems first. A second one isn’t required for a change.",
    ),
    ["ME-021", "ME-024", "ME-017"],
  ),
  "ME-019": entry(
    copy(
      "细长灯杆可以给阅读角一个竖向线条。旁边家具不必再都有强轮廓。",
      "The slender stem gives a reading corner a vertical line. The nearby furniture needn’t all make equally strong statements.",
    ),
    copy(
      "台灯先看要照哪里，再谈造型。沙发边阅读与台面氛围，对摆位的要求不同。",
      "Start with what the lamp should light. Reading beside a sofa and adding atmosphere to a surface need different positions.",
    ),
    copy(
      "如果你已经有一盏灯，可以先调整它的位置。我们要补的是照明需求，不是单纯多一个物件。",
      "If you already have a lamp, try moving it first. The aim is to address a lighting need rather than simply add another object.",
    ),
    copy(
      "到店需要核对实际光线、开关、电源与电气规格。也可以感受亮度与照明的舒适度。",
      "Check the light, switch, power supply and electrical specifications in person. The image doesn’t establish brightness or reading comfort.",
    ),
    copy(
      "单椅加灯已经能形成一个清楚的阅读角；只有确实需要放杯子时，再考虑边几。",
      "A chair and lamp already make a clear reading corner. Add a side table only if you need somewhere for a cup.",
    ),
    copy(
      "灯和边几不是功能上的替代品。若预算只留一件，先决定缺照明还是缺置物面。",
      "A lamp and a side table serve different purposes. If the budget covers one, decide whether the missing function is light or a surface.",
    ),
    ["ME-017", "ME-021", "ME-020"],
  ),
  "ME-020": entry(
    copy(
      "低调织纹适合给座位添一点层次，不需要换掉大件家具。",
      "Quiet texture can give seating another layer without replacing the larger furniture.",
    ),
    copy(
      "靠垫不必越多越好。先试一只，看看是否还留得下舒服坐的位置。",
      "More cushions aren’t automatically better. Start with one and check that the seat still has room to use.",
    ),
    copy(
      "如果只是想让客厅柔和一点，小件可以先于单椅。先确认现有靠垫有没有已经承担这个作用。",
      "For a softer living room, a small textile can come before a new chair. First check whether an existing cushion already does the job.",
    ),
    copy(
      "到店可以感受尺寸与手感，也可以一起了解内芯和清洁护理方式。",
      "Explore the dimensions and texture, and ask about the filling and care instructions.",
    ),
    copy(
      "配单椅时，它负责触感层次；若再加毛毯，就把花器与台面陈列减一点。",
      "With the lounge chair, it adds a textural layer. If you also use a throw, simplify the objects on nearby surfaces.",
    ),
    copy(
      "想要色块变化可以比较羊毛毯；想小范围调整座位，这只靠垫更适合先试。两者不是尺寸相同的替代。",
      "Compare the wool throw for a block of colour. For a small change to seating, start with the cushion. They aren’t like-for-like sizes.",
    ),
    ["ME-017", "ME-022", "ME-021"],
    "ME-022",
  ),
  "ME-021": entry(
    copy(
      "圆边几可以给椅子旁留一个小小的落点。先想杯子、书或灯哪一个最需要放在手边。",
      "A round side table can give a chair a useful landing spot. Decide whether a cup, book or lamp is what you most need within reach.",
    ),
    copy(
      "小空间里，边几的用途要比陈列更明确。通道先留出来，桌上也不必放满。",
      "In a compact room, give the table a clear use before decorating it. Keep the walkway open and the surface partly free.",
    ),
    copy(
      "再看这张边几，可以把它和现有座位一起想。放得下之外，还要确认高度和伸手是否顺。",
      "Picture it beside the seating you already have. Beyond fitting into the space, check the height and reach.",
    ),
    copy(
      "到店需要核对直径、高度与底部形状，再和门口、座位旁的尺寸对照。概念图只帮助看关系。",
      "Check the diameter, height and base, then compare them with the doorway and space beside your seat. The scene only helps show the relationship.",
    ),
    copy(
      "杯组适合把它变成日常角落；花器适合少量陈列。若要放台灯，先核对尺寸、电源和稳定放置。",
      "The cups make it an everyday corner; a vessel makes a spare display. For a lamp, first check dimensions, power and a stable position.",
    ),
    copy(
      "如果只想归拢现有台面的小物，托盘也许就够了；如果确实缺置物面，才需要看边几。",
      "If you only want to gather objects on an existing surface, a tray may be enough. Choose the side table when you actually need another surface.",
    ),
    ["ME-023", "ME-018", "ME-019", "ME-024"],
  ),
  "ME-022": entry(
    copy(
      "毛毯的抽象色块适合成为座位旁的一处变化。靠垫和其他小物可以安静一点。",
      "The throw’s abstract blocks can be the change beside a seat. Keep the cushions and smaller objects quieter.",
    ),
    copy(
      "如果房间已经有图案，不妨只看它和一件大件家具的关系，别再叠第三种图案。",
      "If the room already has pattern, consider the throw against one large piece of furniture rather than adding a third pattern.",
    ),
    copy(
      "你若想给原来的椅子换个表情，先从一条毛毯开始就可以，不必连椅子一起换。",
      "To change the mood of an existing chair, a throw can be a starting point. The chair needn’t be replaced too.",
    ),
    copy(
      "到店可核对尺寸、织纹与护理要求。图片里的披搭方式不代表真实覆盖范围。",
      "Check the size, weave and care requirements in person. The styling image doesn’t establish how much it will cover.",
    ),
    copy(
      "和单椅搭时，让毛毯负责色块、台灯负责线条，靠垫就选少一点。",
      "Let the throw provide the colour blocks and the lamp the line beside a chair. Keep cushions restrained.",
    ),
    copy(
      "如果只需要局部柔化，靠垫是另一种选择；窗帘样本则只供配色，不能当毛毯替代品。",
      "A cushion is another option for a smaller soft layer. The curtain sample is only for colour reference and cannot replace a throw.",
    ),
    ["ME-017", "ME-019", "ME-020"],
    "ME-020",
  ),
  "ME-023": entry(
    copy(
      "一对瓷杯可以把角落带回日常：不用先做满陈列，留一个能坐下来喝点东西的位置就好。",
      "A pair of cups can bring a corner into everyday life. It doesn’t need a full display, just a place to sit with a drink.",
    ),
    copy(
      "如果柜子里已经有够用的杯子，先挑常用的摆出来。新的仪式感不一定来自新的一组。",
      "If the cupboard already has enough cups, put your favourites to use. A new ritual doesn’t have to come from a new set.",
    ),
    copy(
      "再看杯组，可以先想它会放在哪儿、多久用一次。比“家里总能用上”更容易判断。",
      "Consider where you’d keep the pair and how often you’d use it. That’s clearer than assuming more cups always come in handy.",
    ),
    copy(
      "到店可以比较容量、杯口与握持手感，也可以了解日常护理方式。",
      "Compare the capacity, rim and feel in your hand, and explore everyday care.",
    ),
    copy(
      "放在边几上，可以只留杯子；需要把小物归拢时，再比较托盘，不必默认成套买。",
      "On a side table, the cups can stand alone. Consider the tray only if you need to gather other objects; buying them together is optional.",
    ),
    copy(
      "这对杯子适合留给日常的慢时光，也可以搭配花器，让边几多一点生活气息。",
      "Keep this pair for unhurried everyday moments, and add a vessel for a thoughtful side-table arrangement.",
    ),
    ["ME-021", "ME-024", "ME-018"],
  ),
  "ME-024": entry(
    copy(
      "托盘可以把零散小物收成一组，台面也更容易保留空白。不必为了托盘再添装饰。",
      "A tray can gather smaller objects while leaving the rest of a surface clear. It needn’t be a reason to buy more decorations.",
    ),
    copy(
      "先看你已经有什么需要归拢。钥匙、随手小物或陈列的用途不同，适不适用要核对规格。",
      "Start with what needs gathering. Keys, daily objects and display pieces call for different uses; check the specifications.",
    ),
    copy(
      "如果你又看回它，也可以先用家里已有的浅盘试一下摆位，确认这真是你需要的功能。",
      "If you’re returning to it, try the arrangement with a shallow dish you already have to check that the function is useful.",
    ),
    copy(
      "到店可以比较尺寸、底部与表面质感，并了解适合的使用和护理方式。",
      "Compare its dimensions, base and finish, and ask about suitable uses and care.",
    ),
    copy(
      "和花器一起时，只留一两样小物就够；配杯组前，要先确认托盘的实际用途与承放要求。",
      "With the vessel, one or two objects are enough. Before using it with cups, confirm the intended use and support requirements.",
    ),
    copy(
      "如果缺的是一个新的置物面，应比较边几；托盘只整理已有台面，不会增加一张桌子的功能。",
      "If you need another surface, compare the side table. A tray organises an existing surface; it doesn’t do the job of a table.",
    ),
    ["ME-018", "ME-021", "ME-023"],
  ),
  "ME-025": entry(
    copy(
      "短版外套把线条停在上半身，下装可以延续得长一点。先看比例，不急着加更多层。",
      "The cropped jacket keeps the outer line higher. A longer line below can balance it; consider proportion before adding layers.",
    ),
    copy(
      "如果常穿长裤，可以先把外套和裤腰的位置一起看。短版不自动等于显高，要看实际搭配。",
      "If you often wear trousers, consider the jacket against the waistband. Cropped doesn’t automatically mean more flattering; the whole outfit matters.",
    ),
    copy(
      "再看它时，可以和长大衣分清用途：一个改变上半身比例，一个延续长线条。",
      "On another look, separate its purpose from the long coat: one changes the top-half proportion, the other continues a long line.",
    ),
    copy(
      "到店时可以在里面搭一件常穿的上装，试试肩部、袖口与衣摆的舒适度。",
      "Try it over a regular top and check the comfort around the shoulders, cuffs and hem.",
    ),
    copy(
      "和细羊毛圆领衫搭，会有轻松的层次；下装先用现有直筒裤，帆布包只是可选收尾。",
      "The wool crewneck gives it an easy layer. Start with existing straight trousers; the canvas bag is an optional finish.",
    ),
    copy(
      "想比较长外套，可以看丝毛混纺大衣；价差之外，还要分清材质与穿着场景，不作性能等同。",
      "Compare the silk-wool coat for a longer line. Beyond price, the materials and uses differ; performance isn’t equivalent.",
    ),
    ["ME-026", "ME-003", "ME-027", "ME-007"],
    "ME-009",
  ),
  "ME-026": entry(
    copy(
      "干净圆领适合给现有中性色衣服加一处变化，版面不用再堆很多细节。",
      "A clean crewneck can add one change to neutral clothes without bringing lots of extra detail.",
    ),
    copy(
      "先让针织做唯一的颜色重点，外套和下装用已有的简洁单品看看，通常更容易判断。",
      "Let the knit be the single colour accent and consider it with simple pieces you already have. That makes the decision easier to read.",
    ),
    copy(
      "如果你想小幅更新衣橱，一件上装就可以先试；不用同时换掉外套、包和鞋。",
      "For a small wardrobe refresh, one top can be a starting point. The coat, bag and shoes needn’t all change at once.",
    ),
    copy(
      "到店可以比较领口、袖长和贴身程度。人物示例与产品图都不能替代合身检查。",
      "Check the neckline, sleeve length and closeness of fit in person. Neither the persona scene nor the product image replaces that.",
    ),
    copy(
      "配羊毛直筒裤会更利落，配缎面裙会多一点柔和光泽；短风衣可等确实需要外层时再加。",
      "Wool trousers make it sharper; satin adds a softer sheen. Add the cropped trench only if an outer layer is actually needed.",
    ),
    copy(
      "和羊绒针织比较时，可以分开看价格、材质标注和你想要的层次。不能仅凭材质名替你判定手感。",
      "Against the cashmere knit, separate the price, listed material and layering role. A material name alone can’t determine the feel for you.",
    ),
    ["ME-003", "ME-005", "ME-025", "ME-027"],
    "ME-006",
  ),
  "ME-027": entry(
    copy(
      "松弛的帆布结构，可以把剪裁感衣服带得日常一点。包不一定要和鞋同材质、同颜色。",
      "The relaxed canvas structure can make tailored clothes feel more everyday. The bag needn’t match the shoes in material or colour.",
    ),
    copy(
      "先想你通常带的东西，再看包的开口和背法。页面没有尺寸和容量，不先判断电脑能否装下。",
      "Start with what you carry, then check the opening and carry options. Without dimensions or capacity, I can’t say a laptop will fit.",
    ),
    copy(
      "若你在帆布和皮革之间犹豫，可以先分清是日常随手用，还是想让包成为造型重点。",
      "Between canvas and leather, decide whether you want an easy daily carry or a bag that becomes the outfit’s accent.",
    ),
    copy(
      "到店可核对重量感、带长和收纳结构。演示图只能帮助看整体方向。",
      "Check the perceived weight, strap length and compartments in person. The demo image only shows a general direction.",
    ),
    copy(
      "和短风衣、圆领针织搭，会偏轻松日常；如果上装已经有变化，包就安静收尾。",
      "With the cropped trench and crewneck, this takes an easy everyday direction. If the top already adds interest, keep the bag as the quiet finish.",
    ),
    copy(
      "皮革弧线包是另一种材质与轮廓，不是单纯更贵或更好的同款。先看你要它承担什么用途。",
      "The arc leather bag brings a different material and shape; it isn’t simply a pricier or better version of the same thing. Start with the role you need.",
    ),
    ["ME-025", "ME-026", "ME-003", "ME-015"],
    "ME-004",
  ),
  "ME-028": entry(
    copy(
      "这是一份窗帘配色样本，可以先看它和墙面、家具的关系，不是完整窗帘。",
      "This is a curtain colour sample for considering it beside walls and furniture, not a complete curtain.",
    ),
    copy(
      "样本可以靠近窗边和室内各看一次；不同光线下的观感值得比较，但页面不能替代真实看样。",
      "Consider the sample near the window and deeper in the room. Different light is worth comparing; the page can’t replace a physical sample.",
    ),
    copy(
      "如果你在调整房间配色，先确定主色和现有大件，再选样本，不需要从头换一整个房间。",
      "For a palette change, start with the main colour and existing large furniture, then choose a sample. The whole room needn’t start again.",
    ),
    copy(
      "这一项仅为样本，价格不包含成品窗帘、测量或安装。布料规格、用量与服务都要另行核对。",
      "This item is only a sample. Its price excludes finished curtains, measuring and installation; fabric specifications, quantities and services need separate checking.",
    ),
    copy(
      "可以把样本与家中现有大件的颜色并看，用它决定方向；不用为这份样本再补家具或软装。",
      "Compare the sample with the colours of existing large furniture to choose a direction. It doesn’t call for additional furniture or textiles.",
    ),
    copy(
      "它虽然在目录里使用通用软装分类，但用途仍是窗帘样本，不能当作毛毯、靠垫或完整窗帘推荐。",
      "Although the catalog uses a generic textile category, its purpose is a curtain sample. It mustn’t be recommended as a throw, cushion or finished curtain.",
    ),
    [],
    null,
  ),
};

export const guideDialogueProvenance = Object.freeze({
  mode: "demo",
  source: "ai-authored-script",
  provider: null,
  label: copy("AI 编写的本地模拟导购", "AI-authored local guide simulation"),
  disclosure: copy(
    "当前对话使用预先编写的模拟脚本；商品、购买记录、库存和预约均为演示。",
    "This conversation uses prepared simulated dialogue. Products, purchase history, inventory and appointments are demos.",
  ),
});

const langOf = (language) => (language === "en" ? "en" : "zh");
const textOf = (line, language) => line?.[langOf(language)] || "";
const nameOf = (item, language) => (language === "en" ? item.en : item.name);
const validIds = (ids) => [...new Set(ids.filter((id) => byId(id)))];
const disabled = (feedback, id) =>
  ["less", "dislike", false, -1].includes(feedback?.[id]);
const numericBudget = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
const allIntents = new Set([
  "browse",
  "compare",
  "budget",
  "occasion",
  "warmminimal",
  "homepalette",
  "ownedpairing",
  "avoidduplicate",
  "dislike",
  "visit",
  "color",
  "size",
  "pairing",
  "consider",
  "series",
]);

/** Explicit UI intent wins. Text classification does not mutate filters/history. */
export function detectGuideIntent(message = "") {
  const text = String(message).trim();
  if (
    /不喜欢|不要这|不想要|不感兴趣|别推|dislike|don.?t like|not for me|skip (this|it)|not my style/i.test(
      text,
    )
  )
    return "dislike";
  if (
    /重复|别买重|避免再买|同款|(?:记录|已有|已买|already).*(?:还.*买|再买|need.*buy)|duplicate|already (have|own)|buy.*again/i.test(
      text,
    )
  )
    return "avoidduplicate";
  if (
    /同系列|同一系列|系列|same[ -]?(series|collection)|collection/i.test(text)
  )
    return "series";
  if (
    /预约|到店|路线|楼层|备货|试穿|试坐|visit|appointment|booking|book a|route|try.*(on|store)/i.test(
      text,
    )
  )
    return "visit";
  if (
    /预算|便宜|更省|省钱|价差|以内|替代|budget|cheaper|under\s*\d|cost|afford|alternative/i.test(
      text,
    )
  )
    return "budget";
  if (
    /已有|已买|买过|记录|衣橱|历史|owned|history|previous|wardrobe|pair.*own/i.test(
      text,
    )
  )
    return "ownedpairing";
  if (
    /比较|对比|区别|不同|和.*比|哪件|哪款|compare|difference|versus|\bvs\b|which one/i.test(
      text,
    )
  )
    return "compare";
  if (/尺码|大小|合身|鞋码|size|fit\b|measurement/i.test(text)) return "size";
  if (/温暖.*极简|极简.*温暖|暖.*简|温暖|暖色|极简|warm|minimal/i.test(text))
    return "warmminimal";
  if (
    /家.*配色|空间.*配色|客厅.*颜色|家居色|home palette|room.*colou?r|palette/i.test(
      text,
    )
  )
    return "homepalette";
  if (
    /场合|上班|通勤|晚餐|约会|周末|聚会|occasion|workday|work\b|office|dinner|weekend|event/i.test(
      text,
    )
  )
    return "occasion";
  if (/颜色|配色|换色|colou?r|shade/i.test(text)) return "color";
  if (
    /搭配|穿搭|整套|一套|摆放|空间|outfit|pair|style this|style.*piece|complete look|placement|space|room/i.test(
      text,
    )
  )
    return "pairing";
  if (
    /注意|考虑|材质|手感|面料|护理|consider|material|care|fabric|texture/i.test(
      text,
    )
  )
    return "consider";
  return "browse";
}

/** Use only current catalog-valid selection; invalid supplied values are exposed. */
export function resolveGuideVariant(itemOrId, selected = {}, profile = {}) {
  const item = typeof itemOrId === "string" ? byId(itemOrId) : itemOrId;
  if (!item) return null;
  const colorSupplied = Object.hasOwn(selected || {}, "color");
  const sizeSupplied = Object.hasOwn(selected || {}, "size");
  const invalidColor = colorSupplied && !item.colors.includes(selected.color);
  const invalidSize = sizeSupplied && !item.sizes.includes(selected.size);
  return {
    color: item.colors.includes(selected?.color) ? selected.color : item.color,
    size: item.sizes.includes(selected?.size)
      ? selected.size
      : item.sizes.includes(profile?.size)
        ? profile.size
        : item.sizes[0],
    colorExplicit: colorSupplied && !invalidColor,
    sizeExplicit: sizeSupplied && !invalidSize,
    invalidColor,
    invalidSize,
  };
}

/** The only same-series authority is a nonempty, identical catalog collection ID. */
export function declaredGuideRelationship(one, two) {
  const a = typeof one === "string" ? byId(one) : one;
  const b = typeof two === "string" ? byId(two) : two;
  if (!a || !b) return "unverified";
  if (a.id === b.id) return "duplicate";
  return typeof a.collectionId === "string" &&
    a.collectionId.trim() &&
    a.collectionId === b.collectionId
    ? "same-series"
    : "pairing";
}

function normalizedContext(args) {
  const language = langOf(args.language);
  const event = args.event || {};
  const profile = args.profile || {};
  const item = byId(event.productId || args.productId || args.contextProductId);
  const rawVariant = {
    ...(event.value && typeof event.value === "object" ? event.value : {}),
    ...(event.variant || {}),
    ...(args.variant || {}),
    ...(event.color !== undefined ? { color: event.color } : {}),
    ...(event.size !== undefined ? { size: event.size } : {}),
  };
  const history = sanitizePurchaseHistory(
    args.history ?? args.purchaseHistory ?? [],
  );
  const ownedIds = new Set(history.map((line) => line.skuId));
  const message = String(args.message || "");
  const requested = requestedBudget(message);
  const budget =
    requested ??
    numericBudget(args.budget) ??
    numericBudget(args.filters?.budget) ??
    numericBudget(profile.budget) ??
    Infinity;
  const rawIntent = args.intent || event.intent;
  const intent = allIntents.has(rawIntent)
    ? rawIntent
    : detectGuideIntent(message);
  const inventory = args.inventory || {};
  const available = (p) => {
    const value = Object.hasOwn(inventory, p.id) ? inventory[p.id] : p.stock;
    return Number.isInteger(value) && value > 0;
  };
  const feedback = args.feedback || {};
  const persona = personaPresets.find((p) => p.id === profile.personaId);
  const home = homePresets.find((p) => p.id === profile.homeId);
  const homeContext =
    item?.category === "home" ||
    args.filters?.category === "home" ||
    intent === "homepalette";
  const includeBothDepartments =
    !item &&
    (!args.filters?.category || args.filters.category === "all") &&
    !homeContext;
  const department =
    item && ["women", "men"].includes(item.category)
      ? item.category
      : clothingDepartmentFor(profile);
  const directives = args.conversationDirectives || {};
  const allowed = (p, ignoreBudget = false) =>
    !directives.excludedKinds?.includes(p.kind) &&
    !directives.excludedNewKinds?.includes(p.kind) &&
    !directives.avoidedColors?.includes(
      p.id === item?.id && rawVariant.color ? rawVariant.color : p.color,
    ) &&
    !ownedIds.has(p.id) &&
    !disabled(feedback, p.id) &&
    available(p) &&
    (ignoreBudget || p.price <= budget) &&
    (homeContext
      ? p.category === "home"
      : (includeBothDepartments && p.category === "home") ||
        (p.category !== "home" &&
          (!department ||
            p.category === department ||
            p.category === "accessories")));
  const t = (zh, en) => (language === "en" ? en : zh);
  const name = (p) => nameOf(p, language);
  const price = (p) => money(typeof p === "number" ? p : p.price, language);
  return {
    ...args,
    event,
    profile,
    item,
    language,
    history,
    ownedIds,
    budget,
    intent,
    feedback,
    home,
    persona,
    department,
    giftContext: isOppositeClothingDepartment(item, profile),
    homeContext,
    available,
    allowed,
    t,
    name,
    price,
    variant: item ? resolveGuideVariant(item, rawVariant, profile) : null,
  };
}

function compatible(one, two) {
  if (
    !one ||
    !two ||
    one.id === two.id ||
    one.id === "ME-028" ||
    two.id === "ME-028"
  )
    return false;
  if ((one.category === "home") !== (two.category === "home")) return false;
  if (
    ["women", "men"].every((category) =>
      [one.category, two.category].includes(category),
    )
  )
    return false;
  const clothing = [
    "blazer",
    "shirt",
    "knit",
    "trouser",
    "skirt",
    "dress",
    "coat",
  ];
  const pairs = [
    ["blazer", "shirt"],
    ["blazer", "knit"],
    ["blazer", "trouser"],
    ["blazer", "skirt"],
    ["blazer", "dress"],
    ["blazer", "coat"],
    ["shirt", "trouser"],
    ["shirt", "skirt"],
    ["shirt", "coat"],
    ["knit", "trouser"],
    ["knit", "skirt"],
    ["knit", "coat"],
    ["coat", "trouser"],
    ["coat", "skirt"],
    ["coat", "dress"],
    ...clothing.flatMap((kind) =>
      ["bag", "shoe", "jewelry"].map((other) => [kind, other]),
    ),
    ["belt", "trouser"],
    ["belt", "dress"],
    ["belt", "shirt"],
    ["bag", "shoe"],
    ["bag", "jewelry"],
    ["bag", "belt"],
    ["chair", "lamp"],
    ["chair", "table"],
    ["chair", "cushion"],
    ["chair", "throw"],
    ["chair", "vase"],
    ["table", "lamp"],
    ["table", "vase"],
    ["table", "cup"],
    ["table", "tray"],
    ["cushion", "throw"],
    ["cup", "tray"],
    ["vase", "tray"],
  ];
  const kindMatch = pairs.some(
    ([a, b]) =>
      (one.kind === a && two.kind === b) || (one.kind === b && two.kind === a),
  );
  const editorialMatch =
    dialogueBank[one.id]?.companions.includes(two.id) ||
    dialogueBank[two.id]?.companions.includes(one.id);
  return kindMatch && editorialMatch;
}

function ownedFor(ctx) {
  if (!ctx.item) return [];
  return ctx.history
    .map((line) => ({ ...line, item: byId(line.skuId) }))
    .filter(
      (line) =>
        compatible(ctx.item, line.item) &&
        !ctx.conversationDirectives?.excludedKinds?.includes(line.item.kind) &&
        !ctx.conversationDirectives?.avoidedColors?.includes(line.color) &&
        !disabled(ctx.feedback, line.item.id),
    )
    .sort(
      (a, b) =>
        Number(declaredGuideRelationship(ctx.item, b.item) === "same-series") -
        Number(declaredGuideRelationship(ctx.item, a.item) === "same-series"),
    );
}

function ownershipLine(ctx, line, compact = false) {
  if (!line) return "";
  const { t, name } = ctx;
  if (compact)
    return (
      t(
        `记录里有「${name(line.item)}」（${line.color} · ${line.size}），可以先用它。`,
        `Your history lists ${name(line.item)} (${line.color} · ${line.size}); start with that. `,
      ) +
      (declaredGuideRelationship(ctx.item, line.item) === "same-series"
        ? t(
            `两件同属「${ctx.item.collectionZh}」。`,
            `Both are in the “${ctx.item.collectionEn}” series.`,
          )
        : t(
            "可以互补搭配。",
            "A complementary pairing.",
          ))
    );
  const relationship = declaredGuideRelationship(ctx.item, line.item);
  return (
    t(
      `已有记录里有「${name(line.item)}」（${line.color} · ${line.size}）。`,
      `Your history lists ${name(line.item)} (${line.color} · ${line.size}). `,
    ) +
    (relationship === "same-series"
      ? t(
          `它与这件同属「${ctx.item.collectionZh}」，可以比较你喜欢的颜色组合。`,
          `It shares the “${ctx.item.collectionEn}” collection with this piece; explore your preferred colour combination.`,
        )
      : t(
          "可以从轮廓与配色出发，组合成喜欢的搭配。",
          "Explore their shapes and colours as complementary pieces.",
        ))
  );
}

function currentOutfit(ctx) {
  return buildCatalogOutfit({
    productId: ctx.item?.id,
    history: ctx.history,
    profile: ctx.profile,
    variant: ctx.variant,
    budget: ctx.budget,
    language: ctx.language,
    inventory: ctx.inventory,
    preferredProductIds: dialogueBank[ctx.item?.id]?.companions || [],
    excludedProductIds: catalog
      .filter((item) => disabled(ctx.feedback, item.id))
      .map((item) => item.id),
    excludedKinds: ctx.conversationDirectives?.excludedKinds || [],
    excludedNewKinds: ctx.conversationDirectives?.excludedNewKinds || [],
    avoidedColors: ctx.conversationDirectives?.avoidedColors || [],
  });
}

function outfitExplanation(ctx, outfit, compact = false) {
  if (!outfit) return "";
  const labels = {
    top: ["上装", "top"],
    bottom: ["下装", "bottom"],
    shoes: ["鞋履", "shoes"],
    accessory: ["配饰", "accessory"],
    onePiece: ["连衣裙", "one-piece dress"],
    outerwear: ["外套", "outerwear"],
  };
  const components = outfit.components.filter(
    (component) => !compact || component.productId !== ctx.item?.id,
  );
  if (!components.length) return "";
  const description = components
    .map((component) => {
      const item = byId(component.productId);
      const slot = labels[component.slot][ctx.language === "en" ? 1 : 0];
      return ctx.t(
        `${slot}用「${ctx.name(item)}」${component.source === "owned" ? `（记录已有 ${component.color} · ${component.size}）` : ""}`,
        `${slot}: ${ctx.name(item)}${component.source === "owned" ? ` (in current history: ${component.color} · ${component.size})` : ""}`,
      );
    })
    .join(ctx.t("；", "; "));
  return ctx.t(
    `搭配思路：${description}。${outfit.complete ? "这一组有完整穿搭构成，不必买齐。" : "先用已有单品搭配，只补充预算内喜欢的部分。"}`,
    `Outfit idea: ${description}. ${outfit.complete ? "Choose the pieces you love; buying the whole look is optional." : "Build on what you already have and add only what you need."}`,
  );
}

function giftLine(ctx, compact = false) {
  if (!ctx.giftContext) return "";
  return ctx.t(
    `这是${ctx.item.category === "women" ? "女装" : "男装"}选款；${compact ? "可作为可选礼物灵感。" : "如果你在为别人挑礼物，可以把它作为一个可选方向，尺码与喜好要由收礼人确认。"}`,
    `This is a ${ctx.item.category === "women" ? "women’s" : "men’s"} clothing piece; ${compact ? "an optional gifting idea." : "if you’re choosing for someone else, it can be an optional gift idea. The recipient’s preferences and size still need checking."}`,
  );
}

function proactiveOwnershipLine(ctx, line, phase) {
  if (!line) return "";
  const label = `${ctx.name(line.item)} (${line.color} · ${line.size})`;
  const openings = {
    initial: ctx.t(
      `先接上已有记录：「${ctx.name(line.item)}」（${line.color} · ${line.size}）可以与这件互补。`,
      `Start with ${label} in your history as a complementary piece.`,
    ),
    dwell: ctx.t(
      `停下来细看时，可以先保留记录里的「${ctx.name(line.item)}」（${line.color} · ${line.size}），用它试这件的比例，不用再买同一角色。`,
      `While considering the proportions, keep ${label} from the your history in the outfit instead of buying that role again.`,
    ),
    revisit: ctx.t(
      `再看回来，仍可先用记录里的「${ctx.name(line.item)}」（${line.color} · ${line.size}），只比较这件是否带来需要的变化。`,
      `On this return, reuse ${label} from the your history and consider only whether this piece adds a useful change.`,
    ),
    click: ctx.t(
      `按当前选款，先拿记录里的「${ctx.name(line.item)}」（${line.color} · ${line.size}）来接，已有这件不计新增预算。`,
      `For this selection, build around ${label} in your history; that existing piece adds no new spending.`,
    ),
  };
  return (
    openings[phase] +
    (ctx.language === "en" ? " " : "") +
    (declaredGuideRelationship(ctx.item, line.item) === "same-series"
      ? ctx.t(
          `两件同属「${ctx.item.collectionZh}」系列。`,
          `Both are in the “${ctx.item.collectionEn}” series.`,
        )
      : ctx.t(
          "这组搭配可以保留各自的特点，又彼此呼应。",
          "A complementary pairing that lets each piece retain its character.",
        ))
  );
}

function candidateSet(ctx, { includeViewed = true, max = 3 } = {}) {
  const { item, allowed, ownedIds, budget } = ctx;
  if (!item) return [];
  let remaining = budget;
  const result = [];
  if (includeViewed && !ownedIds.has(item.id)) {
    if (!allowed(item) || item.price > remaining) return [];
    result.push(item);
    remaining -= item.price;
  }
  const usedKinds = new Set([item.kind]);
  for (const id of dialogueBank[item.id]?.companions || []) {
    const p = byId(id);
    if (!p || !allowed(p) || p.price > remaining || usedKinds.has(p.kind))
      continue;
    result.push(p);
    usedKinds.add(p.kind);
    remaining -= p.price;
    if (result.length >= max) break;
  }
  return result;
}

function quickReplies(ctx, ids = []) {
  const home = ctx.homeContext;
  const labels = {
    outfit: ctx.t("用已有衣服搭一套", "Build around owned pieces"),
    room: ctx.t("搭配这个角落", "Style this corner"),
    color: ctx.t("比较当前配色", "Compare current colours"),
    compare: ctx.t("和另一款比一比", "Compare another option"),
    budget: ctx.t("先守住预算", "Stay within budget"),
    occasion: ctx.t("按场合来搭", "Style for an occasion"),
    history: ctx.t("查看已有记录", "Review example history"),
    booking: ctx.t("整理到店试选", "Prepare a demo visit"),
    view: ctx.t("继续看看", "Keep browsing"),
    consider: ctx.t("到店重点看什么", "What to check in person"),
    details: ctx.t("细看材质与细节", "Consider materials and details"),
    alternative: ctx.t("看看更低价选项", "Explore a lower-price option"),
  };
  return [
    ...new Set(
      [...ids, home ? "room" : "outfit", "color"].map((id) =>
        id === "consider" ? "details" : id === "budget" ? "alternative" : id,
      ),
    ),
  ]
    .slice(0, 3)
    .map((id) => ({ id, label: labels[id] || id }));
}

function makeReply(ctx, text, suggested = [], extras = {}) {
  const suggestedIds = validIds(
    suggested.map((p) => (typeof p === "string" ? p : p.id)),
  ).filter((id) => ctx.allowed(byId(id)));
  return {
    role: "assistant",
    text,
    visualText: text,
    mode: "demo",
    source: "ai-authored-script",
    provider: null,
    contextProductId: ctx.item?.id || null,
    productIds: suggestedIds,
    suggestedProductIds: suggestedIds,
    ownedProductIds: [],
    quickReplies: quickReplies(ctx),
    ...extras,
  };
}

function paletteLine(ctx) {
  const { t, profile, home } = ctx;
  const palette = profile.palette || home?.palette;
  const room = {
    living: ["客厅", "living room"],
    kitchen: ["厨房", "kitchen"],
    bedroom: ["卧室", "bedroom"],
    dining: ["餐厅", "dining room"],
    study: ["书房", "study"],
  }[profile.room];
  const place = room
    ? room[ctx.language === "en" ? 1 : 0]
    : t("这个空间", "the space");
  const opening =
    palette === "blue"
      ? t(
          `你当前给${place}选的是蓝色方向，可以把暖木色当一小块平衡，别让每件都抢颜色。`,
          `Your current ${place} direction is blue. A little warm wood can balance it; every piece needn’t compete for colour.`,
        )
      : palette === "warm"
        ? t(
            `你当前给${place}选的是温暖方向，可以让大件保持温和，小件只留一处颜色变化。`,
            `Your current ${place} direction is warm. Keep larger pieces calm and allow just one small colour accent.`,
          )
        : palette === "artful"
          ? t(
              `你当前给${place}选的是艺术感方向，可以保留一件有轮廓的主角，周围少放一点。`,
              `Your current ${place} direction is artful. Let one sculptural piece lead and give it space.`,
            )
          : t(
              `先保留${place}现有的大面积颜色，再选一处小变化。`,
              `Keep the existing large colour areas in ${place}, then choose one small change.`,
            );
  const compact =
    home?.id === "compact-city"
      ? t(
          "城市小家优先保留通道，家具尺寸还要实测。",
          "For the compact-city preset, prioritise clear circulation and check actual furniture measurements.",
        )
      : "";
  return opening + (ctx.language === "en" && compact ? " " : "") + compact;
}

function seriesReply(ctx) {
  const { item, t, name } = ctx;
  if (!item)
    return makeReply(
      ctx,
      t(
        "先选一件你喜欢的单品，我来帮你找同系列或协调的搭配。",
        "Choose a piece you like and I’ll help you explore its collection or complementary options.",
      ),
    );
  const peers = catalog.filter(
    (p) =>
      p.id !== item.id && declaredGuideRelationship(item, p) === "same-series",
  );
  if (!peers.length)
    return makeReply(
      ctx,
      t(
        `「${name(item)}」暂时没有其他系列选款，可以从配色与轮廓出发寻找搭配。`,
        `There are no other collection pieces to show for ${name(item)} right now. We can explore complementary colours and shapes instead.`,
      ),
      [],
      { relationship: "unverified" },
    );
  const peer = peers[0];
  const owned = ctx.history.find((line) => line.skuId === peer.id);
  const text =
    t(
      `「${name(item)}」与「${name(peer)}」同属「${item.collectionZh}」。`,
      `${name(item)} and ${name(peer)} belong to the “${item.collectionEn}” series. `,
    ) +
    (owned
      ? t(
          `记录中的那件是 ${owned.color} · ${owned.size}，可以先用已有这件；当前选色 ${ctx.variant.color} 另行比较。`,
          `The history variant is ${owned.color} · ${owned.size}; use that existing piece first and compare it with your current ${ctx.variant.color} selection.`,
        )
      : t(
          "到店时可以比较面料与颜色，也可以只选最喜欢的一件。",
          "Compare the fabrics and colours in person, and choose only the pieces you love.",
        ));
  return makeReply(ctx, text, owned ? [] : [peer], {
    ownedProductIds: owned ? [peer.id] : [],
    relationship: "same-series",
  });
}

function visitReply(ctx) {
  const { t, name, price } = ctx;
  // Looking at a piece is not choosing it for a visit. In particular, an old
  // viewed colour may have been declined or exceed a newer stated budget.
  const rawLines = Array.isArray(ctx.cart) ? ctx.cart : [];
  const lines = rawLines
    .filter((line) => byId(line?.skuId))
    .map((line) => {
      const p = byId(line.skuId);
      const v = resolveGuideVariant(p, line, ctx.profile);
      return {
        skuId: p.id,
        color: v.color,
        size: v.size,
        quantity:
          Number.isInteger(line.quantity) && line.quantity > 0
            ? line.quantity
            : 1,
        needsVariantConfirmation:
          v.invalidColor ||
          v.invalidSize ||
          !v.colorExplicit ||
          !v.sizeExplicit,
        floor: p.floor,
        counter: p.counter,
      };
    });
  if (!lines.length)
    return makeReply(
      ctx,
      t(
        "到店袋还是空的。先把想看的单品加入，选好颜色与规格，再安排到店时间。",
        "Your visit bag is empty. Add a piece you would like to see, choose its colour and options, then plan your visit.",
      ),
      [],
      { quickReplies: quickReplies(ctx, ["view"]) },
    );
  const groups = [...new Set(lines.map((line) => line.floor))]
    .sort((a, b) => a - b)
    .map((floor) => ({
      floor,
      counters: [
        ...new Set(
          lines
            .filter((line) => line.floor === floor)
            .map((line) => line.counter),
        ),
      ],
    }));
  const route = groups
    .map((group) => `${group.floor}F ${group.counters.join(" / ")}`)
    .join(" → ");
  const list = lines
    .slice(0, 3)
    .map(
      (line) =>
        `${name(byId(line.skuId))} ${line.color} · ${line.size}${line.quantity > 1 ? ` ×${line.quantity}` : ""}`,
    )
    .join(t("；", "; "));
  const total = lines.reduce(
    (sum, line) => sum + byId(line.skuId).price * line.quantity,
    0,
  );
  const first = byId(lines[0].skuId);
  const fitting =
    first.kind === "shoe"
      ? t(
          "鞋款没有真实鞋码，到店单独核对。",
          "There is no real shoe sizing; confirm it in store. ",
        )
      : first.category === "home"
        ? t(
            "带上实际空间与搬入路线尺寸，重点看材质和尺度。",
            "Bring actual room and access measurements to check materials and scale. ",
          )
        : t(
            "尺码仅作为试穿起点，重点看肩部、坐下与活动状态。",
            "Use the size as a fitting starting point; check the shoulders, seated shape and movement. ",
          );
  const needsConfirm = lines.some((line) => line.needsVariantConfirmation);
  const text =
    t(
      `可以按这份演示清单试选：${list}${lines.length > 3 ? `等 ${lines.length} 款` : ""}。目录合计 ${price(total)}，示意路线 ${route}。`,
      `A demo visit checklist: ${list}${lines.length > 3 ? `, among ${lines.length} styles` : ""}. Catalog total ${price(total)}; suggested floor route ${route}. `,
    ) +
    fitting +
    (needsConfirm
      ? t(
          "其中有规格尚未确认，先在页面选定。",
          "Some options still need confirming on the product page. ",
        )
      : "") +
    t(
      "再选方便的时间；这不会确认真实预约、库存或已为你留货。",
      "Then choose a convenient time. This does not confirm a real appointment, stock or reserved items.",
    );
  return makeReply(ctx, text, [], {
    visitPlan: {
      lines,
      route: groups,
      total,
      currency: "CNY",
      status: "demo-unconfirmed",
    },
    quickReplies: quickReplies(ctx, ["booking"]),
  });
}

function pairingReply(ctx) {
  const { item, t, name, price } = ctx;
  if (!item) return initialReply(ctx);
  const outfit = currentOutfit(ctx);
  const owned = ownedFor(ctx);
  for (const component of outfit?.components || [])
    if (
      component.source === "owned" &&
      component.productId !== item.id &&
      !owned.some((line) => line.skuId === component.productId)
    )
      owned.push({
        ...component,
        skuId: component.productId,
        item: byId(component.productId),
      });
  const newItems = outfit
    ? outfit.productIds.map(byId)
    : candidateSet(ctx, { max: 3 });
  const total = newItems.reduce((sum, p) => sum + p.price, 0);
  const baseOwned = ctx.ownedIds.has(item.id);
  const noRoom =
    !baseOwned && (item.price > ctx.budget || !ctx.available(item));
  let text =
    giftLine(ctx) +
    (ctx.giftContext && ctx.language === "en" ? " " : "") +
    textOf(dialogueBank[item.id].followUps.pairing, ctx.language);
  if (owned.length)
    text +=
      t("先接上已有记录：", " Start with your history: ") +
      owned
        .slice(0, 2)
        .map((line) => `${name(line.item)}（${line.color} · ${line.size}）`)
        .join(t("、", ", ")) +
      t("，这些不计入新增预算。", "; these do not count toward new spending.");
  else
    text += t(
      "可以先从下面这些单品中挑选喜欢的搭配。",
      " Explore the pieces below for a complementary look.",
    );
  const extras = newItems.filter((p) => p.id !== item.id);
  if (noRoom)
    text +=
      item.price > ctx.budget
        ? t(
            `这件 ${price(item)} 已超出当前 ${price(ctx.budget)} 预算，先不加买。`,
            ` At ${price(item)}, this exceeds the current ${price(ctx.budget)} budget, so I won’t add purchases around it.`,
          )
        : t(
            "这件在当前演示库存中不可选，先不把它列成可准备的组合。",
            " This piece is unavailable in current demo inventory, so it isn’t a ready-to-prepare combination.",
          );
  else if (extras.length)
    text +=
      t(
        `可选新增：${extras.map((p) => `${name(p)} ${price(p)}`).join("、")}。`,
        ` Optional additions: ${extras.map((p) => `${name(p)} ${price(p)}`).join("; ")}. `,
      ) +
      t(
        `包含本次未拥有单品的新增合计 ${price(total)}，无需整组买齐。`,
        `New-piece total, including the viewed piece if not owned: ${price(total)}. Nothing needs to be bought as a full group.`,
      );
  else
    text += t(
      "先用已有物品试搭，不再为凑一组加购。",
      " Start with existing pieces rather than buying extras to complete a group.",
    );
  if (owned.length)
    text += t(
      `配色可把记录中的 ${owned[0].color} 与当前 ${ctx.variant.color} 并看；这只是搭配建议。`,
      ` The palette pairs ${owned[0].color} with ${ctx.variant.color}; this is a styling suggestion.`,
    );
  const sameSeries = owned.some(
    (line) => declaredGuideRelationship(item, line.item) === "same-series",
  );
  if (owned.length && !sameSeries)
    text += t(
      "可以按喜欢的配色与风格自由组合。",
      " Combine them through the colours and styling you enjoy.",
    );
  if (sameSeries)
    text += t(
      `还可以衔接已有的「${item.collectionZh}」系列单品。`,
      ` You can also build around your existing piece from the “${item.collectionEn}” collection.`,
    );
  if (outfit)
    text += (ctx.language === "en" ? " " : "") + outfitExplanation(ctx, outfit);
  return makeReply(ctx, text, newItems, {
    ownedProductIds: validIds([
      ...owned.map((line) => line.skuId),
      ...(outfit?.ownedProductIds || []),
    ]),
    outfit,
    giftContext: ctx.giftContext,
    relationship: sameSeries ? "same-series" : "pairing",
    sameSeriesVerified: sameSeries,
    newItemsTotal: total,
    budgetScope: "suggested-new-items-total",
    quickReplies: quickReplies(ctx, ["budget", "consider"]),
  });
}

function compareReply(ctx) {
  const { item, t, name, price } = ctx;
  if (!item) return initialReply(ctx);
  const explicit = byId(ctx.compareProductId || ctx.event.compareProductId);
  const comparison = explicit || byId(dialogueBank[item.id].compareId);
  if (!comparison || comparison.id === item.id)
    return makeReply(
      ctx,
      textOf(dialogueBank[item.id].followUps.consider, ctx.language),
      [],
      { quickReplies: quickReplies(ctx, ["consider", "budget"]) },
    );
  const delta = Math.abs(item.price - comparison.price);
  const sameDept = item.category === comparison.category;
  const priceLine = t(
    `「${name(item)}」${price(item)}；「${name(comparison)}」${price(comparison)}，目录价相差 ${price(delta)}。`,
    `${name(item)} is ${price(item)}; ${name(comparison)} is ${price(comparison)}, a catalog difference of ${price(delta)}. `,
  );
  const dressAndTop =
    [item.kind, comparison.kind].includes("dress") &&
    [item.kind, comparison.kind].some((kind) =>
      ["knit", "shirt"].includes(kind),
    );
  const shirtAndKnit =
    [item.kind, comparison.kind].includes("shirt") &&
    [item.kind, comparison.kind].includes("knit");
  const comparisonNote = dressAndTop
    ? t(
        "长裙是一件形成完整轮廓；针织或衬衫是上装，需要接上下装。若记录里已有合适长裤，上装方向可以只添一件，长裙则是另一种穿法。",
        "The dress gives a one-piece silhouette; the knit or shirt is a top that needs a bottom. If suitable trousers are already in the history, the top direction may need just one addition. The dress offers a different way of dressing.",
      )
    : shirtAndKnit
      ? t(
          "衬衫偏挺括、线条清楚，针织用纹理带来柔和层次。周末想放松可以先看针织，想更利落则比较衬衫；合身都要实际试。",
          "The shirt gives a crisper, clearer line; the knit brings softer texture. For an easy weekend direction, start with the knit; for a sharper finish, compare the shirt. Both still need a fitting.",
        )
      : explicit
        ? t(
            `「${name(item)}」：${textOf(dialogueBank[item.id].browsing.initial, ctx.language)}「${name(comparison)}」：${textOf(dialogueBank[comparison.id].browsing.initial, ctx.language)}`,
            `${name(item)}: ${textOf(dialogueBank[item.id].browsing.initial, ctx.language)} ${name(comparison)}: ${textOf(dialogueBank[comparison.id].browsing.initial, ctx.language)}`,
          )
        : textOf(dialogueBank[item.id].followUps.consider, ctx.language);
  const caution = !sameDept
    ? t(
        "两件分属不同品类或部门，这里只比较方向，不擅自替换你的选择。",
        "They belong to different categories or departments. This compares directions without replacing your selection. ",
      )
    : "";
  const inventoryLine = !ctx.available(comparison)
    ? t(
        "比较款当前演示库存不可选。",
        "The comparison piece is unavailable in current demo inventory. ",
      )
    : "";
  return makeReply(
    ctx,
    priceLine +
      comparisonNote +
      (ctx.language === "en" ? " " : "") +
      caution +
      inventoryLine,
    ctx.allowed(comparison) ? [comparison] : [],
    {
      comparedProductIds: [item.id, comparison.id],
      quickReplies: quickReplies(ctx, ["color", "budget"]),
    },
  );
}

function budgetReply(ctx) {
  const { item, t, name, price } = ctx;
  if (!Number.isFinite(ctx.budget))
    return makeReply(
      ctx,
      t(
        "先给我一个本次新增预算，我就能把已有单品排除，算一组实际需要补的选项。",
        "Give me a new-spending budget and I can exclude owned pieces and total only the additions.",
      ),
    );
  const alternatives = catalog
    .filter(
      (p) =>
        ctx.allowed(p) &&
        (!item ||
          (p.id !== item.id && p.kind === item.kind && p.price < item.price)) &&
        p.id !== "ME-028",
    )
    .sort((a, b) => a.price - b.price);
  const candidate = alternatives[0];
  if (item && ctx.ownedIds.has(item.id))
    return makeReply(
      ctx,
      t(
        `记录里已有「${name(item)}」，这件先计作零新增。当前预算 ${price(ctx.budget)} 可以先留着，不必因预算还有余量就再买同款。`,
        `The history already includes ${name(item)}, so start at zero new spending. Keep the current ${price(ctx.budget)} budget rather than buying the same SKU because there is room left.`,
      ),
      [],
      { ownedProductIds: [item.id], newItemsTotal: 0 },
    );
  if (candidate && item)
    return makeReply(
      ctx,
      t(
        `先守住 ${price(ctx.budget)} 的单品预算，可以比较「${name(candidate)}」${price(candidate)}，比这件少 ${price(item.price - candidate.price)}。属于同类目录选项，但材质与用途仍要分别看；先比较一件，不继续叠加。`,
        `Within the ${price(ctx.budget)} per-item budget, compare ${name(candidate)} at ${price(candidate)}, ${price(item.price - candidate.price)} less than this one. They are the same catalog type, but materials and uses differ. Compare one option rather than adding more.`,
      ),
      [candidate],
      {
        newItemsTotal: candidate.price,
        quickReplies: quickReplies(ctx, ["compare", "consider"]),
      },
    );
  if (
    item &&
    item.category !== "home" &&
    (item.price > ctx.budget ||
      /替代|alternative|低调|quieter/i.test(ctx.message || ""))
  ) {
    const ownedBottoms = ctx.history
      .map((line) => ({ ...line, item: byId(line.skuId) }))
      .filter((line) => ["trouser", "skirt"].includes(line.item.kind));
    const direction = catalog
      .filter(
        (p) =>
          p.id !== item.id &&
          ctx.allowed(p) &&
          ["knit", "shirt"].includes(p.kind) &&
          ownedBottoms.some((line) => compatible(p, line.item)),
      )
      .sort(
        (a, b) =>
          Number(b.tags.includes("quiet")) - Number(a.tags.includes("quiet")) ||
          a.price - b.price,
      )[0];
    const existing =
      direction &&
      ownedBottoms.find((line) => compatible(direction, line.item));
    if (direction && existing)
      return makeReply(
        ctx,
        t(
          `目录没有这款更低价的同类替代，可以换一种完整穿法：「${name(direction)}」${price(direction)}，搭记录里的「${name(existing.item)}」（${existing.color} · ${existing.size}）。这与原来的${name(item)}是不同轮廓，不是假定有一条更便宜的同款；新增合计 ${price(direction)}，先不加其他配件。`,
          `There is no cheaper catalog version of this type, but another complete direction is ${name(direction)} at ${price(direction)}, with the recorded ${name(existing.item)} (${existing.color} · ${existing.size}). This gives a different silhouette from ${name(item)}, rather than inventing a cheaper version. New spending totals ${price(direction)}; no extra accessories needed.`,
        ),
        [direction],
        {
          ownedProductIds: [existing.skuId],
          newItemsTotal: direction.price,
          alternativeForProductId: item.id,
          alternativeRelationship: "different-silhouette",
          quickReplies: quickReplies(ctx, ["compare", "details"]),
        },
      );
  }
  if (item && item.price > ctx.budget)
    return makeReply(
      ctx,
      t(
        `这件 ${price(item)} 超过当前 ${price(ctx.budget)} 预算；同类型里没有可选的更低价目录款。可以先保留想法，用已有物品搭配，不必提高预算。`,
        `At ${price(item)}, this exceeds your ${price(ctx.budget)} budget. There is no available lower-priced catalog option of the same type. Keep the idea and use existing pieces; there’s no need to raise the budget.`,
      ),
      [],
      { newItemsTotal: 0 },
    );
  if (item) return pairingReply(ctx);
  const picks = alternatives.slice(0, 2);
  const total = picks.reduce((sum, p) => sum + p.price, 0);
  const feasible = total <= ctx.budget ? picks : picks.slice(0, 1);
  return makeReply(
    ctx,
    feasible.length
      ? t(
          `当前单品预算 ${price(ctx.budget)}。先看 ${feasible.map((p) => `「${name(p)}」${price(p)}`).join("、")}；可选合计 ${price(feasible.reduce((sum, p) => sum + p.price, 0))}，只选需要的。`,
          `Current per-item budget: ${price(ctx.budget)}. Start with ${feasible.map((p) => `${name(p)} ${price(p)}`).join("; ")}. Optional total ${price(feasible.reduce((sum, p) => sum + p.price, 0))}; choose only what is useful.`,
        )
      : t(
          "当前预算内没有未拥有、可选的目录单品。先不加购也可以。",
          "There are no unowned, available catalog pieces within this budget. Adding nothing is fine.",
        ),
    feasible,
    { newItemsTotal: feasible.reduce((sum, p) => sum + p.price, 0) },
  );
}

function initialReply(ctx) {
  const { item, t, name, price } = ctx;
  if (!item) {
    const scenario = curatedScenarioFor(ctx.profile);
    const ids = scenario
      ? scenario.products
          .filter((p) => !ctx.homeContext || p.type === "room")
          .map((p) => p.skuId)
      : catalog
          .filter(
            (p) =>
              ctx.allowed(p) &&
              p.tags.some((tag) => ctx.profile.styles?.includes(tag)),
          )
          .slice(0, 2)
          .map((p) => p.id);
    const choices = ids.map(byId).filter((p) => ctx.allowed(p));
    const introduction = ctx.homeContext
      ? paletteLine(ctx)
      : scenario
        ? t(
            `沿着「${scenario.zh}」这一组，可以先看穿着，再看家里的一处角落。人物、家居和场景都用你当前选择的演示设定。`,
            `In “${scenario.en}”, start with the outfit, then one corner at home. The person, home and scene follow your current demo selections.`,
          )
        : t(
            "先从一件会实际用到的东西开始：你可以给我一个场合、一处空间，或直接点开喜欢的单品。",
            "Start with something you would actually use. Give me an occasion or a corner at home, or open a piece that catches your eye.",
          );
    return makeReply(ctx, introduction, choices, {
      quickReplies: quickReplies(ctx, ["occasion", "budget"]),
    });
  }
  const bank = dialogueBank[item.id];
  const phase =
    ctx.event.type === "dwell"
      ? "dwell"
      : ctx.event.type === "revisit" ||
          ctx.event.revisit ||
          ctx.event.visitCount > 1
        ? "revisit"
        : ["product_open", "click", "product_view"].includes(ctx.event.type) ||
            ["click", "product_view"].includes(ctx.event.attentionKind)
          ? "click"
          : "initial";
  let text = textOf(bank.browsing[phase], ctx.language);
  const selected = ctx.variant;
  if (phase !== "click")
    text = t(`「${name(item)}」：`, `${name(item)}: `) + text;
  if (phase === "click")
    text =
      t(
        `「${name(item)}」${price(item)}，当前 ${selected.color} · ${selected.size}。`,
        `${name(item)}, ${price(item)}, currently ${selected.color} · ${selected.size}. `,
      ) + text;
  if (ctx.giftContext)
    text = giftLine(ctx) + (ctx.language === "en" ? " " : "") + text;
  const exactOwned = ctx.history.find((line) => line.skuId === item.id);
  const ownedPairings = ownedFor(ctx);
  const outfit = currentOutfit(ctx);
  if (exactOwned)
    text += t(
      `已有记录已选有同款（${exactOwned.color} · ${exactOwned.size}），先核对是否真的需要重复。`,
      ` The example history already has the same SKU (${exactOwned.color} · ${exactOwned.size}); check whether another is genuinely needed.`,
    );
  else {
    const owned = ownedPairings[0];
    if (owned)
      text +=
        (ctx.language === "en" ? " " : "") +
        proactiveOwnershipLine(ctx, owned, phase) +
        t(
          `配色可将记录中的 ${owned.color} 与当前 ${selected.color} 并看。`,
          ` The palette pairs ${owned.color} with ${selected.color}.`,
        );
  }
  if (outfit && ["initial", "click", "dwell"].includes(phase))
    text +=
      (ctx.language === "en" ? " " : "") +
      outfitExplanation(ctx, outfit, phase === "dwell");
  if (!ctx.available(item))
    text += t(
      "这件暂时不可选，可以先收藏搭配灵感。",
      " This piece is currently unavailable; save the styling idea for later.",
    );
  if (item.price > ctx.budget && !exactOwned)
    text += t(
      `这件超过当前 ${price(ctx.budget)} 预算，可以只看搭配思路。`,
      ` It exceeds your current ${price(ctx.budget)} budget; you can keep just the styling idea.`,
    );
  const scene = personalizedSceneFor(item.id, ctx.profile, selected.color);
  if (scene && ctx.event.type === "attention")
    text += t(
      "可以一起看看整体的轮廓与配色。",
      " Explore the overall silhouette and colour balance.",
    );
  // Keep the floating reading surface compact. The full rationale, exact saved
  // variant and prepared-scene explanation stay in the expanded conversation.
  const outfitOwned = outfit?.components.find(
    (component) => component.source === "owned",
  );
  const ownedReference =
    exactOwned ||
    ownedPairings[0] ||
    (outfitOwned
      ? {
          ...outfitOwned,
          skuId: outfitOwned.productId,
          item: byId(outfitOwned.productId),
        }
      : null);
  const firstThought = textOf(bank.browsing[phase], ctx.language).split(
    /[。.!?]/,
  )[0];
  const limit = ctx.language === "en" ? 44 : 22;
  const shortThought =
    firstThought.length > limit
      ? (ctx.language === "en"
          ? firstThought.slice(0, limit).replace(/\s+\S*$/, "")
          : firstThought.slice(0, limit)
        ).trimEnd() + "…"
      : firstThought;
  const relationship = exactOwned
    ? "duplicate"
    : ownedReference
      ? declaredGuideRelationship(item, ownedReference.item)
      : undefined;
  let visualText = t(
    `「${name(item)}」：${shortThought}`,
    `${name(item)}: ${shortThought}`,
  );
  if (ownedReference) {
    if (relationship === "duplicate")
      visualText = t(
        `「${name(item)}」记录已有同款 ${ownedReference.color} · ${ownedReference.size}，先检查重复。`,
        `${name(item)} is already in the example history (${ownedReference.color} · ${ownedReference.size}); check a repeat.`,
      );
    else {
      const ownedName = name(ownedReference.item);
      const compactPairing = {
        initial: t(
          `「${name(item)}」可先接记录已有「${ownedName}」`,
          `${name(item)}: start with ${ownedName} from the your history`,
        ),
        dwell: t(
          `细看「${name(item)}」比例时，先用记录已有「${ownedName}」`,
          `Consider ${name(item)} with ${ownedName} from the your history`,
        ),
        revisit: t(
          `再看「${name(item)}」，仍可重用记录已有「${ownedName}」`,
          `Revisit ${name(item)} around ${ownedName} from the your history`,
        ),
        click: t(
          `当前 ${selected.color}「${name(item)}」，先接记录已有「${ownedName}」`,
          `Selected ${selected.color} ${name(item)} + ${ownedName} from the your history`,
        ),
      };
      visualText =
        compactPairing[phase] +
        t(
          ` · ${relationship === "same-series" ? "同系列搭配" : "互补搭配"}`,
          ` · ${relationship === "same-series" ? "collection pairing" : "complementary pairing"}`,
        );
    }
  }
  if (ctx.giftContext)
    visualText =
      giftLine(ctx, true) + (ctx.language === "en" ? " " : "") + visualText;
  const suggestions = exactOwned
    ? []
    : ctx.message
      ? [item]
      : (outfit?.productIds || []).filter((id) => id !== item.id).slice(0, 3);
  return makeReply(ctx, text, suggestions, {
    phase,
    visualText,
    outfit,
    giftContext: ctx.giftContext,
    ...(outfit
      ? { newItemsTotal: outfit.newItemsTotal, budgetScope: outfit.budgetScope }
      : {}),
    ownedProductIds: validIds([
      ...(exactOwned
        ? [item.id]
        : ownedPairings.slice(0, 1).map((line) => line.skuId)),
      ...(outfit?.ownedProductIds || []),
    ]),
    relationship,
    quickReplies: quickReplies(ctx, [
      exactOwned ? "history" : "consider",
    ]).slice(0, 2),
  });
}

/**
 * Pure drop-in reply factory. Read README-guide-dialogue-bank.md for event and
 * consent integration. Never pass stored replies as a substitute for fresh state.
 */
function renderGuideDialogueReply(args = {}) {
  const ctx = normalizedContext(args);
  const { item, variant, t, name, price, intent } = ctx;
  if (
    intent === "visit" ||
    (ctx.event.type === "page" &&
      [ctx.event.page, ctx.event.section, ctx.event.value].includes("visit"))
  )
    return visitReply(ctx);
  if (intent === "series") return seriesReply(ctx);
  if (intent === "dislike") {
    const alternatives = catalog
      .filter(
        (p) =>
          (!item || p.id !== item.id) &&
          ctx.allowed(p) &&
          (!item || p.kind === item.kind),
      )
      .sort((a, b) => a.price - b.price)
      .slice(0, 1);
    const text = item
      ? t(
          `那就先略过「${name(item)}」。你可以说是不喜欢轮廓、颜色还是材质；我会按这一点换方向，不把整类都排除。`,
          `Let’s skip ${name(item)}. Tell me whether it’s the shape, colour or material and I can change that part without excluding the whole category.`,
        )
      : t(
          "好，先换个方向。是颜色、材质，还是整体感觉不对？",
          "Let’s change direction. Is it the colour, material or overall feel?",
        );
    return makeReply(ctx, text, alternatives, {
      quickReplies: quickReplies(ctx, ["view", "color"]),
      preferenceSuggestion: item
        ? {
            productId: item.id,
            value: "less",
            persistence: "caller-controlled",
          }
        : null,
    });
  }
  if (intent === "avoidduplicate") {
    const duplicate = ctx.history.find((line) => line.skuId === item?.id);
    if (duplicate)
      return makeReply(
        ctx,
        t(
          `记录里已有「${name(item)}」（${duplicate.color} · ${duplicate.size}）。当前 ${variant.color} · ${variant.size} 仍是同一 SKU；除非你明确想补另一件，先不重复选。`,
          `The history already has ${name(item)} (${duplicate.color} · ${duplicate.size}). Your current ${variant.color} · ${variant.size} is still the same SKU. Unless you explicitly want another, skip a repeat.`,
        ),
        [],
        {
          ownedProductIds: [item.id],
          relationship: "duplicate",
          duplicate: true,
          quickReplies: quickReplies(ctx, ["history", "view"]),
        },
      );
    return makeReply(
      ctx,
      ctx.history.length
        ? t(
            `当前记录中没有${item ? `「${name(item)}」的同款` : "选中单品的重复项"}。我只依据这 ${ctx.history.length} 条当前记录核对，不把收藏或到店袋算作已买。`,
            `The current history has no duplicate ${item ? `of ${name(item)}` : "of the selected piece"}. This checks only the ${ctx.history.length} current history entries; saved and bag pieces do not count as owned.`,
          )
        : t(
            "已有记录为空，所以无法替你确认真实衣橱是否重复。可以先补充记录，我再核对同款与互补单品。",
            "The example history is empty, so I can’t establish duplicates in your real wardrobe. Add entries first and I can check repeated SKUs and complementary pieces.",
          ),
      [],
      { duplicate: false },
    );
  }
  if (intent === "ownedpairing") {
    if (!ctx.history.length)
      return makeReply(
        ctx,
        t(
          "已有记录是空的，我不会补出“你已经买过”的单品。你可以添加记录，或先看不依赖已有物品的目录搭配。",
          "The your history is empty. I won’t invent owned pieces. Add entries, or explore catalog styling without ownership assumptions.",
        ),
        [],
        {
          quickReplies: quickReplies(ctx, [
            "history",
            ctx.homeContext ? "room" : "outfit",
          ]),
        },
      );
    if (!item)
      return makeReply(
        ctx,
        t(
          `已有记录有 ${ctx.history.length} 款。先点一件想搭的单品，我会用记录中的具体颜色和规格来对照。`,
          `There are ${ctx.history.length} styles in your history. Open a piece and I’ll compare it with the exact recorded colours and options.`,
        ),
        [],
        {
          ownedProductIds: ctx.history.map((line) => line.skuId),
          quickReplies: quickReplies(ctx, ["history", "view"]),
        },
      );
    if (ctx.ownedIds.has(item.id))
      return renderGuideDialogueReply({ ...args, intent: "avoidduplicate" });
    const owned = ownedFor(ctx);
    if (!owned.length)
      return makeReply(
        ctx,
        t(
          "当前记录里没有和这件有明确互补关系的单品。先不牵强配对；可以改看另一件，或编辑已有记录。",
          "The current history has no clearly complementary piece for this item. I won’t force a pairing; choose another piece or edit the example history.",
        ),
        [],
        { quickReplies: quickReplies(ctx, ["history", "view"]) },
      );
    return pairingReply(ctx);
  }
  if (intent === "budget") return budgetReply(ctx);
  if (intent === "compare") return compareReply(ctx);
  if (intent === "pairing") return pairingReply(ctx);
  if (intent === "consider" && item)
    return makeReply(
      ctx,
      textOf(dialogueBank[item.id].followUps.consider, ctx.language),
      [],
      { quickReplies: quickReplies(ctx, ["color", "compare"]) },
    );
  if (intent === "homepalette")
    return makeReply(
      ctx,
      paletteLine(ctx) +
        (item
          ? t(
              `你正在看的选色是 ${variant.color}；`,
              ` The selected colour is ${variant.color}; `,
            ) + textOf(dialogueBank[item.id].followUps.pairing, ctx.language)
          : ""),
      item && ctx.allowed(item) ? [item] : [],
      { quickReplies: quickReplies(ctx, ["room", "color"]) },
    );
  if (intent === "warmminimal") {
    const text = ctx.homeContext
      ? paletteLine(ctx)
      : t(
          "温暖和极简可以一起保留：颜色不必多，用一种柔和织纹接住一件利落单品，配饰只留一个重点。",
          "Warmth and minimalism can work together: a restrained palette, one soft texture beside one clean-lined piece, and just one accessory accent.",
        );
    const styles = Array.isArray(ctx.profile.styles) ? ctx.profile.styles : [];
    const remembered =
      styles.includes("warm") && styles.includes("quiet")
        ? t(
            "这也和你当前选择的“温暖、克制”方向一致。",
            " That follows your current warm-and-quiet preferences.",
          )
        : t(
            "这是本次搭配方向，是否保存为偏好由你决定。",
            " This is a direction for this conversation; you decide whether to save it as a preference.",
          );
    const smallHome =
      ctx.homeContext && !item
        ? catalog
            .filter(
              (p) =>
                ctx.allowed(p) &&
                ["cushion", "vase", "tray", "cup", "throw"].includes(p.kind) &&
                p.id !== "ME-028",
            )
            .sort(
              (a, b) =>
                b.tags.filter((tag) => ctx.profile.styles?.includes(tag))
                  .length -
                  a.tags.filter((tag) => ctx.profile.styles?.includes(tag))
                    .length || a.price - b.price,
            )
            .slice(0, 2)
        : [];
    const specifics = smallHome.length
      ? t(
          `先比较 ${smallHome.map((p) => `「${name(p)}」${price(p)}`).join("、")} 这样的小件，按需要选一件，不必动大件家具。`,
          ` Start with smaller pieces such as ${smallHome.map((p) => `${name(p)} ${price(p)}`).join(" or ")}. Choose one useful change before replacing furniture.`,
        )
      : "";
    return makeReply(
      ctx,
      text +
        remembered +
        specifics +
        (item
          ? (ctx.language === "en" ? " " : "") +
            textOf(dialogueBank[item.id].followUps.pairing, ctx.language)
          : ""),
      item ? candidateSet(ctx, { max: 2 }) : smallHome,
      { quickReplies: quickReplies(ctx, ["budget", "color"]) },
    );
  }
  if (intent === "occasion") {
    if (ctx.homeContext)
      return makeReply(
        ctx,
        paletteLine(ctx) +
          t(
            "想用于日常阅读、招待，还是只是整理台面？用途决定先补哪一种功能。",
            " Is this for everyday reading, having guests or simply tidying a surface? The use determines which function comes first.",
          ),
        [],
        { quickReplies: quickReplies(ctx, ["room", "budget"]) },
      );
    const evening = /晚餐|聚会|约会|dinner|evening|event/i.test(
      ctx.message || "",
    );
    const casual = /周末|休闲|weekend|casual/i.test(ctx.message || "");
    const opening = evening
      ? t(
          "晚餐不一定要整套换新：保留一件清楚的主角，把其余配饰减下来。",
          "Dinner needn’t mean a whole new outfit. Keep one clear lead piece and simplify the accessories.",
        )
      : casual
        ? t(
            "周末可以把结构感留给一件，其余选轻松的轮廓，先用你已经常穿的鞋包。",
            "For the weekend, keep structure in one piece and let the rest feel easy. Start with shoes and a bag you already use.",
          )
        : t(
            "如果是通勤，可以先看上装与下装的线条，再决定是否需要外套。是日常上班，还是偏正式的一天？",
            "For work, consider the top and bottom together before adding a jacket. Is this an ordinary day or a more formal one?",
          );
    return makeReply(
      ctx,
      opening +
        (item
          ? (ctx.language === "en" ? " " : "") +
            textOf(dialogueBank[item.id].followUps.pairing, ctx.language)
          : ""),
      item ? candidateSet(ctx, { max: 3 }) : [],
      { quickReplies: quickReplies(ctx, ["outfit", "budget"]) },
    );
  }
  if (
    item &&
    (intent === "size" ||
      intent === "color" ||
      ctx.event.type === "variant" ||
      ctx.event.type === "variant_change")
  ) {
    const invalid = variant.invalidColor || variant.invalidSize;
    const invalidLine = invalid
      ? t(
          "刚才传入的规格不在目录中，请重新选择；以下只列当前有效选项。",
          "The supplied option is not in the catalog. Please choose again; only valid options are listed below. ",
        )
      : "";
    const selectionLine = t(
      `「${name(item)}」当前参考选项 ${variant.color} · ${variant.size}，目录价 ${price(item)}。`,
      `${name(item)}: current reference options ${variant.color} · ${variant.size}, catalog price ${price(item)}. `,
    );
    let detail;
    if (
      intent === "size" ||
      ctx.event.size !== undefined ||
      (ctx.event.variant?.size !== undefined && !ctx.event.variant?.color)
    )
      detail =
        item.kind === "shoe"
          ? t(
              "这是通用演示规格，不是真实鞋码；需要到店核对鞋号和实际脚感。",
              "These are generic demo options, not real shoe sizing. Confirm the shoe size and feel in person.",
            )
          : item.category === "home"
            ? t(
                "选购前可以量一下摆放位置，比较单品尺寸与空间比例。",
                "Measure the intended spot and compare the piece’s dimensions with your space.",
              )
            : t(
                `目录规格 ${item.sizes.join(" / ")}。你的个人设定仅作为试选起点，不保证合身。`,
                `Catalog options: ${item.sizes.join(" / ")}. Your profile is only a starting point, not a fit guarantee.`,
              );
    else {
      const owned = ownedFor(ctx)[0];
      const scene = personalizedSceneFor(item.id, ctx.profile, variant.color);
      detail =
        t(
          `可选颜色 ${item.colors.join(" / ")}。`,
          `Available catalog colours: ${item.colors.join(" / ")}. `,
        ) +
        (owned
          ? t(
              `可以和记录中「${name(owned.item)}」的 ${owned.color} 并看，先不要求同色。`,
              `Compare with the recorded ${owned.color} of ${name(owned.item)}; the colours needn’t match. `,
            )
          : "") +
        (scene
          ? t(
              "当前颜色有对应的预制场景，帮助看整体关系。",
              "This colour has a corresponding prepared scene for considering the overall relationship.",
            )
          : t(
              "当前颜色没有对应的预制人物或家居场景；产品灵感图不会随选色生成。",
              "This colour has no corresponding prepared persona or room scene. The inspiration image is not regenerated for the selection.",
            ));
    }
    const duplicate = ctx.history.find((line) => line.skuId === item.id);
    if (duplicate)
      detail += t(
        `记录里已有 ${duplicate.color} · ${duplicate.size}，换色或换码仍是同款。`,
        ` The history already has ${duplicate.color} · ${duplicate.size}; another colour or size is still the same SKU.`,
      );
    return makeReply(
      ctx,
      invalidLine + selectionLine + detail,
      duplicate ? [] : [item],
      {
        selectedVariant: { color: variant.color, size: variant.size },
        invalidVariant: invalid,
        ownedProductIds: duplicate ? [item.id] : [],
        quickReplies: quickReplies(ctx, ["consider", "booking"]),
      },
    );
  }
  if (item && ctx.event.type === "save")
    return makeReply(
      ctx,
      ctx.event.saved === false ||
        ctx.event.value === false ||
        ctx.event.value?.saved === false
        ? t(
            `已不再保留「${name(item)}」的收藏。先放下也好，继续比较真正会用到的东西。`,
            `${name(item)} is no longer saved. Leave it for now and keep comparing what you’d actually use.`,
          )
        : t(
            `「${name(item)}」可以先留在收藏里，不急着决定。下一步可和已有物品试搭，收藏本身不等于购买。`,
            `Keep ${name(item)} saved while you decide. Next, consider it with existing pieces; saving it doesn’t mean buying it.`,
          ),
      [],
      { quickReplies: quickReplies(ctx, ["outfit", "budget"]) },
    );
  if (item && ctx.event.type === "add")
    return makeReply(
      ctx,
      t(
        `「${name(item)}」${variant.color} · ${variant.size}，可作为到店试选线索。去清单里再核对颜色、规格和数量；本地到店袋不代表真实留货。`,
        `${name(item)}, ${variant.color} · ${variant.size}, can guide a store try-on. Review the colour, options and quantity in the bag; the local demo bag does not reserve stock.`,
      ),
      [],
      { quickReplies: quickReplies(ctx, ["booking", "budget"]) },
    );
  return initialReply(ctx);
}

/** Exact-preset, cross-department conversation plans. Ownership lines are rendered
 * from current state rather than frozen in these dialogue turns. No age/height
 * based size decision, uploaded-photo inference or invented household claim.
 */
export const curatedDialogueScenarios = [
  {
    id: "warm-everyday",
    requires: {
      personaId: "everyday-woman-45",
      homeId: "warm-family",
      room: "living",
    },
    title: copy(
      "从一条长裙，走到家里的阅读角",
      "From one dress to a reading corner at home",
    ),
    leadIds: ["ME-015", "ME-017"],
    turns: [
      {
        id: "welcome",
        speaker: "guide",
        intent: "browse",
        event: { type: "page" },
        prompt: copy(
          "先从日常穿着和客厅的一角开始。",
          "Start with everyday dressing and one corner of the living room.",
        ),
      },
      {
        id: "dress",
        speaker: "guide",
        intent: "browse",
        event: { type: "attention", productId: "ME-015" },
        prompt: copy(
          "这条长裙先不加腰带，看它原本的直线比例。",
          "Consider the dress’s original column line before adding a belt.",
        ),
      },
      {
        id: "owned",
        speaker: "user",
        intent: "ownedpairing",
        event: { productId: "ME-015" },
        prompt: copy(
          "能和我记录里的鞋包搭吗？不想为一条裙子再买一套。",
          "Can it work with the shoes and bag in my history? I don’t want a whole new outfit for one dress.",
        ),
      },
      {
        id: "palette",
        speaker: "user",
        intent: "homepalette",
        event: { productId: "ME-017" },
        prompt: copy(
          "家里也想保留这种温暖感，但不要太满。",
          "I’d like to keep that warmth at home without filling the room.",
        ),
      },
      {
        id: "chair",
        speaker: "guide",
        intent: "browse",
        event: { type: "dwell", productId: "ME-017" },
        prompt: copy(
          "单椅先看通道与尺度，再决定要不要加边几。",
          "Check circulation and scale before adding a side table beside the chair.",
        ),
      },
      {
        id: "owned-lamp",
        speaker: "user",
        intent: "ownedpairing",
        event: { productId: "ME-017" },
        prompt: copy(
          "先用记录里已有的家居单品，缺什么再补。",
          "Use the home pieces in my history first, and add only what is missing.",
        ),
      },
      {
        id: "budget",
        speaker: "user",
        intent: "budget",
        event: { productId: "ME-017" },
        prompt: copy(
          "先按我当前预算算，不用把配件都添齐。",
          "Use my current budget, without adding every accessory.",
        ),
      },
      {
        id: "visit",
        speaker: "user",
        intent: "visit",
        event: { productId: "ME-015" },
        prompt: copy(
          "把选好的颜色、规格和楼层整理一下，到店再试。",
          "Collect the selected colours, options and floors, so I can check them in store.",
        ),
      },
    ],
  },
  {
    id: "quiet-city",
    requires: {
      personaId: "relaxed-man-50",
      homeId: "compact-city",
      room: "living",
    },
    title: copy(
      "一件针织，一处不拥挤的日常角落",
      "One knit and an uncluttered everyday corner",
    ),
    leadIds: ["ME-014", "ME-021"],
    turns: [
      {
        id: "welcome",
        speaker: "guide",
        intent: "browse",
        event: { type: "page" },
        prompt: copy(
          "先看一件针织，再留意小客厅里的置物面。",
          "Start with a knit, then consider a useful surface in the compact living room.",
        ),
      },
      {
        id: "knit",
        speaker: "guide",
        intent: "browse",
        event: { type: "attention", productId: "ME-014" },
        prompt: copy(
          "用罗纹增加纹理，不急着加外套。",
          "Let the rib add texture before introducing a jacket.",
        ),
      },
      {
        id: "owned-trousers",
        speaker: "user",
        intent: "ownedpairing",
        event: { productId: "ME-014" },
        prompt: copy(
          "先和我记录里的长裤搭，鞋子不一定要新买。",
          "Pair it with the trousers in my history first. I don’t necessarily need new shoes.",
        ),
      },
      {
        id: "compare",
        speaker: "user",
        intent: "compare",
        event: { productId: "ME-014" },
        prompt: copy(
          "和立领衬衫比较一下，周末我想放松一点。",
          "Compare it with the stand-collar shirt. I’d like an easier weekend direction.",
        ),
      },
      {
        id: "table",
        speaker: "guide",
        intent: "browse",
        event: { type: "attention", productId: "ME-021" },
        prompt: copy(
          "小空间里的边几先讲用途，通道仍要留着。",
          "Give the side table a clear use while keeping circulation open.",
        ),
      },
      {
        id: "palette",
        speaker: "user",
        intent: "homepalette",
        event: { productId: "ME-021" },
        prompt: copy(
          "按我现在的家居配色看，别把所有东西都换暖色。",
          "Use my current home palette; don’t turn everything into warm colours.",
        ),
      },
      {
        id: "duplicate",
        speaker: "user",
        intent: "avoidduplicate",
        event: { productId: "ME-019" },
        prompt: copy(
          "这盏灯我记录里有吗？不要重复加。",
          "Is this lamp in my history? Please avoid adding it twice.",
        ),
      },
      {
        id: "visit",
        speaker: "user",
        intent: "visit",
        event: { productId: "ME-014" },
        prompt: copy(
          "先把选好的尺码、颜色和家居尺寸检查点整理好。",
          "Collect the selected size, colour and home-measurement checks for a visit.",
        ),
      },
    ],
  },
];

// New model identities use the same catalog-grounded dialogue structure while
// retaining exact identity requirements and current, independent ownership.
curatedDialogueScenarios.unshift(
  ...[
    ["claire-city-edit", "claire-model-32", "warm-family", "warm-everyday"],
    ["julian-city-edit", "julian-model-34", "compact-city", "quiet-city"],
  ].map(([id, personaId, homeId, sourceId]) => {
    const source = curatedDialogueScenarios.find(
      (entry) => entry.id === sourceId,
    );
    return {
      ...source,
      id,
      requires: { personaId, homeId, room: "living" },
      leadIds: [...source.leadIds],
      turns: source.turns.map((turn) => ({
        ...turn,
        event: { ...turn.event },
      })),
    };
  }),
);

/** Safe scenario preview: exact current presets required; history edits reflected
 * on every turn. The caller controls the turn clock and must respect pause/mute.
 */
export function renderCuratedGuideTurn(scenarioId, turnId, args = {}) {
  const scenario = curatedDialogueScenarios.find((s) => s.id === scenarioId);
  if (
    !scenario ||
    !Object.entries(scenario.requires).every(
      ([key, value]) => args.profile?.[key] === value,
    )
  )
    return null;
  const turn = scenario.turns.find((line) => line.id === turnId);
  if (!turn) return null;
  return {
    scenarioId,
    turnId,
    speaker: turn.speaker,
    userPrompt: textOf(turn.prompt, args.language),
    reply: createGuideDialogueReply({
      ...args,
      message: textOf(turn.prompt, args.language),
      event: { ...turn.event, ...args.event },
      intent: turn.intent,
    }),
  };
}

const productAliases = {
  "ME-001": ["羊毛西装", "廓形西装"],
  "ME-002": ["真丝衬衫", "垂坠衬衫"],
  "ME-003": ["高腰长裤", "女装羊毛裤"],
  "ME-004": ["弧线包", "皮革弧线包", "皮革手袋"],
  "ME-005": ["缎面裙", "缎面半裙"],
  "ME-006": ["羊绒针织", "羊绒衫"],
  "ME-007": ["芭蕾鞋", "芭蕾平底鞋"],
  "ME-008": ["雕塑耳饰"],
  "ME-009": ["长大衣", "丝毛大衣"],
  "ME-010": ["立领衬衫", "棉衬衫", "棉质衬衫"],
  "ME-011": ["双褶长裤", "双褶裤"],
  "ME-012": ["精纺西装", "男装西装"],
  "ME-013": ["麂皮鞋", "麂皮便鞋"],
  "ME-014": ["罗纹针织", "罗纹衫", "罗纹羊绒衫"],
  "ME-015": ["亚麻长裙", "亚麻裙", "那条长裙"],
  "ME-016": ["窄腰带", "皮革腰带"],
  "ME-017": ["曲线单椅", "休闲单椅", "单椅"],
  "ME-018": ["陶瓷花器", "花器"],
  "ME-019": ["黄铜灯", "阅读台灯", "台灯"],
  "ME-020": ["亚麻靠垫", "靠垫"],
  "ME-021": ["橡木边几", "圆边几", "边几"],
  "ME-022": ["羊毛毯", "抽象毛毯"],
  "ME-023": ["咖啡杯", "杯组", "瓷杯"],
  "ME-024": ["石材托盘", "托盘"],
  "ME-025": ["短风衣", "短版风衣"],
  "ME-026": ["蓝色针织", "蓝针织", "细羊毛衫", "圆领衫"],
  "ME-027": ["帆布包", "帆布手袋"],
  "ME-028": ["窗帘样本", "窗帘配色样本"],
};

function namedProducts(message) {
  const text = String(message).toLowerCase();
  const candidates = catalog
    .flatMap((p) => {
      const phrases = [
        p.id,
        p.name,
        p.en,
        p.en.replace(/^The /, ""),
        ...(productAliases[p.id] || []),
      ];
      return phrases
        .map((phrase) => ({
          item: p,
          at: text.indexOf(phrase.toLowerCase()),
          length: phrase.length,
        }))
        .filter((match) => match.at >= 0);
    })
    .sort((a, b) => b.length - a.length || a.at - b.at);
  const selected = [];
  for (const match of candidates)
    if (
      !selected.some(
        (other) =>
          other.item.id === match.item.id ||
          (match.at < other.at + other.length &&
            other.at < match.at + match.length),
      )
    )
      selected.push(match);
  return selected.sort((a, b) => a.at - b.at).map((match) => match.item);
}

function requestedBudget(message) {
  const match = String(message).match(
    /(?:预算\s*(?:是|为|在)?|under|below|up\s*to|budget\s*(?:is|of)?|¥|￥)\s*[¥￥]?\s*(\d{1,6})|(\d{1,6})\s*(?:元)?\s*(?:以内|以下|cny\b|rmb\b)/i,
  );
  return match
    ? Math.min(10000, Math.max(0, Number(match[1] || match[2])))
    : null;
}

function explicitCategory(message) {
  if (
    /家居|客厅|卧室|厨房|房间|\bhome\b|living room|bedroom|kitchen/i.test(
      message,
    )
  )
    return "home";
  if (/男装|男士|\bmenswear\b|\bmen\b/i.test(message)) return "men";
  if (/女装|女士|womenswear|\bwomen\b/i.test(message)) return "women";
  if (/只看配饰|切.*配饰|show.*accessor|browse.*accessor/i.test(message))
    return "accessories";
  return null;
}

function applyConversationDirectives(message, previous) {
  const result = {
    excludedKinds: Array.isArray(previous.excludedKinds)
      ? previous.excludedKinds.filter((value) => typeof value === "string")
      : [],
    excludedNewKinds: Array.isArray(previous.excludedNewKinds)
      ? previous.excludedNewKinds.filter((value) => typeof value === "string")
      : [],
    avoidedColors: Array.isArray(previous.avoidedColors)
      ? previous.avoidedColors.filter((value) => typeof value === "string")
      : [],
  };
  const negative =
    /不喜欢|不要|不想|别|don't|do not|no more|dislike|avoid|skip/i.test(
      message,
    );
  const kindAliases = {
    bag: /手袋|包包|\bbags?\b|handbags?/i,
    shoe: /鞋|\bshoes?\b|footwear/i,
    jewelry: /耳饰|首饰|jewell?ery|earrings?/i,
    belt: /腰带|belts?/i,
    chair: /单椅|椅子|chairs?/i,
    throw: /毛毯|blankets?|throws?/i,
  };
  if (negative)
    for (const [kind, pattern] of Object.entries(kindAliases)) {
      if (
        pattern.test(message) &&
        /不要.*推荐|不想.*买|别.*推荐|不再.*买|no more|don.?t.*recommend|don.?t.*buy|avoid/i.test(
          message,
        )
      )
        result.excludedKinds.push(kind);
    }
  for (const [kind, pattern] of Object.entries(kindAliases))
    if (
      pattern.test(message) &&
      /只.*已有|只.*记录|only.*(own|existing)|use.*(owned|existing)/i.test(
        message,
      )
    )
      result.excludedNewKinds.push(kind);
  const colorTerms = {
    Terracotta: ["Terracotta", "陶土色", "陶土"],
    Burgundy: ["Burgundy", "酒红"],
    Blue: ["Blue", "蓝色"],
    Oat: ["Oat", "燕麦色"],
    Walnut: ["Walnut", "胡桃色"],
    Chalk: ["Chalk", "粉白"],
    Ink: ["Ink", "墨色"],
    Ivory: ["Ivory", "象牙色"],
    Camel: ["Camel", "驼色"],
    Brass: ["Brass", "黄铜色"],
    Sand: ["Sand", "沙色"],
    Oak: ["Oak", "橡木色"],
    Champagne: ["Champagne", "香槟色"],
  };
  if (negative)
    for (const [color, terms] of Object.entries(colorTerms)) {
      if (
        terms.some((term) =>
          new RegExp(
            `(?:不喜欢|不要|避开|dislike|avoid|don.?t like)\\s*.{0,6}${term}`,
            "i",
          ).test(message),
        )
      )
        result.avoidedColors.push(color);
    }
  if (
    /现在|其实|重新|改为|now|actually|reconsider/i.test(message) &&
    /接受|喜欢|考虑|可以|accept|like|reconsider|okay|ok with/i.test(message) &&
    !/不喜欢|不接受|不能|don.?t like|cannot/i.test(message)
  ) {
    for (const [color, terms] of Object.entries(colorTerms))
      if (
        terms.some((term) => message.toLowerCase().includes(term.toLowerCase()))
      )
        result.avoidedColors = result.avoidedColors.filter(
          (value) => value !== color,
        );
    for (const [kind, pattern] of Object.entries(kindAliases))
      if (pattern.test(message)) {
        result.excludedKinds = result.excludedKinds.filter(
          (value) => value !== kind,
        );
        result.excludedNewKinds = result.excludedNewKinds.filter(
          (value) => value !== kind,
        );
      }
  }
  for (const key of Object.keys(result))
    result[key] = [...new Set(result[key])];
  return result;
}

/** Stateful conversation bridge, while catalog/history/profile remain fresh.
 * session contains referents, browsing counts and stated conversational exclusions,
 * never a cached ownership/variant/profile snapshot. Pass returned session forward.
 * nextFilters/profilePatch are proposals for the existing UI to apply, not writes.
 */
export function createGuideDialogueReply(args = {}) {
  const previous =
    args.session && typeof args.session === "object" ? args.session : {};
  const message = String(args.message || "").trim();
  const event = { ...(args.event || {}) };
  const aliases = {
    outfit: "pairing",
    room: "pairing",
    complement: "pairing",
    details: "consider",
    alternative: "budget",
    alternatives: "budget",
    booking: "visit",
    history: "ownedpairing",
  };
  let intent =
    aliases[args.intent || event.intent] ||
    args.intent ||
    event.intent ||
    detectGuideIntent(message);
  const named = namedProducts(message);
  const currentOwnedIds = new Set(
    sanitizePurchaseHistory(args.history ?? args.purchaseHistory ?? []).map(
      (line) => line.skuId,
    ),
  );
  let productId =
    event.productId ||
    args.productId ||
    args.contextProductId ||
    previous.currentProductId ||
    null;
  let compareProductId = args.compareProductId || event.compareProductId;
  if (
    !named.length &&
    /它|这件|这个|\bit\b|this (piece|one|item)/i.test(message) &&
    previous.lastIntent === "budget" &&
    previous.lastSuggestionIds?.length === 1 &&
    previous.lastSuggestionIds[0] !== previous.currentProductId &&
    (!event.productId || event.productId === previous.currentProductId)
  )
    productId = previous.lastSuggestionIds[0];
  if (intent === "ownedpairing" && named.length) {
    const explicitNew = named.filter((p) => !currentOwnedIds.has(p.id));
    if (explicitNew.length) productId = explicitNew[0].id;
  } else if (
    intent === "compare" &&
    named.length === 1 &&
    productId &&
    named[0].id !== productId
  )
    compareProductId = named[0].id;
  else if (named.length) {
    productId = named[0].id;
    if (intent === "compare" && named[1]) compareProductId = named[1].id;
  }
  if (
    intent === "compare" &&
    !compareProductId &&
    /刚才|前面|之前|previous|earlier|before/i.test(message)
  ) {
    const previousId =
      previous.currentProductId !== productId
        ? previous.currentProductId
        : previous.previousProductId ||
          previous.lastComparedProductIds?.find((id) => id !== productId);
    if (byId(previousId) && previousId !== productId)
      compareProductId = previousId;
  }
  const requested = requestedBudget(message);
  const category = explicitCategory(message);
  const nextFilters = { ...(args.filters || {}) };
  let filterChanged = false;
  const acknowledgments = [];
  const en = args.language === "en";
  const t = (zh, english) => (en ? english : zh);
  const reset =
    /清除.*筛选|重置.*筛选|^(清除|重置|reset|clear)( filters?)?$/i.test(
      message,
    );
  if (reset) {
    Object.assign(nextFilters, { query: "", category: "all", budget: 10000 });
    filterChanged = true;
    productId = null;
    intent = "browse";
    acknowledgments.push(t("已清除页面筛选。", "Page filters cleared."));
  } else {
    if (requested !== null) {
      nextFilters.budget = requested;
      filterChanged = true;
      acknowledgments.push(
        t(
          `单品预算先按 ${money(requested, args.language)}。`,
          `Per-item budget: ${money(requested, args.language)}.`,
        ),
      );
    }
    if (category && category !== nextFilters.category) {
      nextFilters.category = category;
      nextFilters.query = "";
      filterChanged = true;
    }
    if (
      category &&
      byId(productId) &&
      (category === "home"
        ? byId(productId).category !== "home"
        : category === "men" || category === "women"
          ? byId(productId).category !== category &&
            byId(productId).category !== "accessories"
          : false) &&
      !named.length
    )
      productId = null;
  }
  const directives = applyConversationDirectives(message, previous);
  const likedProductIds = validIds([
    ...(Array.isArray(previous.likedProductIds)
      ? previous.likedProductIds
      : []),
    ...(/喜欢|love|like this|like it|like the/i.test(message) &&
    !/不喜欢|dislike|don.?t like/i.test(message) &&
    productId
      ? [productId]
      : []),
  ]);
  const skippedProductIds = validIds([
    ...(Array.isArray(previous.skippedProductIds)
      ? previous.skippedProductIds
      : []),
    ...(intent === "dislike" &&
    productId &&
    !directives.avoidedColors.length &&
    !directives.excludedKinds.length
      ? [productId]
      : []),
  ]);
  if (
    /其实.*喜欢|现在.*喜欢|重新考虑|actually.*like|now.*like|reconsider/i.test(
      message,
    ) &&
    productId
  ) {
    const index = skippedProductIds.indexOf(productId);
    if (index >= 0) skippedProductIds.splice(index, 1);
  }
  const feedback = { ...(args.feedback || {}) };
  for (const id of skippedProductIds)
    if (feedback[id] !== "like") feedback[id] = "less";
  const profile = { ...(args.profile || {}) };
  let profilePatch;
  if (message) {
    let styles = Array.isArray(profile.styles) ? [...profile.styles] : [];
    let changed = false;
    if (
      /极简|quiet|minimal/i.test(message) &&
      !/不要.*极简|不喜欢.*极简|don.?t.*minimal/i.test(message)
    ) {
      styles = ["quiet", "tailored"];
      changed = true;
    }
    if (
      /温暖|暖色|\bwarm\b/i.test(message) &&
      !/不要.*暖|不喜欢.*暖|别.*暖|don.?t.*warm/i.test(message)
    ) {
      styles.push("warm");
      changed = true;
    }
    if (
      /艺术|\bartful\b/i.test(message) &&
      !/不要.*艺术|不喜欢.*艺术|don.?t.*artful/i.test(message)
    ) {
      styles.push("artful");
      changed = true;
    }
    if (changed) {
      profilePatch = { styles: [...new Set(styles)] };
      profile.styles = profilePatch.styles;
    }
  }
  event.productId = productId;
  const counts = { ...(previous.browsingCounts || {}) };
  const passive =
    [
      "attention",
      "dwell",
      "revisit",
      "product_open",
      "click",
      "product_view",
    ].includes(event.type) && !message;
  if (passive && productId) {
    const count = Math.max(0, Number(counts[productId]) || 0);
    if (
      event.type === "attention" &&
      !["click", "product_view"].includes(event.attentionKind)
    ) {
      if (count === 1) event.type = "dwell";
      else if (count > 1) {
        event.type = "revisit";
        event.revisit = true;
      }
    }
    counts[productId] = count + 1;
  }
  const selectedVariant = args.variant || event.variant;
  const effectiveArgs = {
    ...args,
    event,
    productId,
    compareProductId,
    message,
    intent,
    profile,
    feedback,
    filters: nextFilters,
    variant: selectedVariant,
    conversationDirectives: directives,
  };
  let response = renderGuideDialogueReply(effectiveArgs);
  if (intent === "dislike" && directives.avoidedColors.length)
    response.text =
      t(
        `${directives.avoidedColors.join(" / ")} 先不作为推荐配色。`,
        `I’ll leave ${directives.avoidedColors.join(" / ")} out of suggested colours for this conversation. `,
      ) +
      (productId
        ? t(
            "这款若还想比较，可以另看目录中的有效颜色；也可以直接换方向。",
            "If you still want to consider this piece, compare another valid catalog colour, or change direction entirely.",
          )
        : t(
            "可以继续看当前预算内、其他配色的选项。",
            "We can continue with other colours within the current budget.",
          ));
  if (
    directives.excludedKinds.includes("bag") &&
    /手袋|包包|\bbags?\b|handbags?/i.test(message)
  )
    response.text += t(
      "这一轮也先不推荐新手袋。",
      " I’ll also leave new bags out of this conversation.",
    );
  if (acknowledgments.length)
    response.text =
      acknowledgments.join(en ? " " : "") + (en ? " " : "") + response.text;
  if (message) response.visualText = response.text;
  if (filterChanged) response.nextFilters = nextFilters;
  if (profilePatch) response.profilePatch = profilePatch;
  const changedProduct = productId && productId !== previous.currentProductId;
  response.session = {
    currentProductId: productId,
    previousProductId: changedProduct
      ? previous.currentProductId || previous.previousProductId || null
      : previous.previousProductId || null,
    lastSuggestionIds: response.productIds,
    lastComparedProductIds:
      response.comparedProductIds || previous.lastComparedProductIds || [],
    lastIntent: intent,
    occasion: intent === "occasion" ? message : previous.occasion || "",
    browsingCounts: counts,
    skippedProductIds,
    likedProductIds,
    ...directives,
    turn: Math.max(0, Number(previous.turn) || 0) + 1,
  };
  response.sessionSummary = guideSessionSummary(
    response.session,
    args.language,
  );
  return response;
}

/** Bounded provider-context bridge: only explicit conversational shopping choices,
 * no photos, age, body measurements, inferred ownership, or account information.
 * Send externally only through the application's existing consented request flow.
 */
export function guideSessionSummary(session = {}, language = "zh") {
  const en = language === "en";
  const parts = [];
  const ids = (values) =>
    validIds(Array.isArray(values) ? values : [])
      .slice(-6)
      .join(", ");
  if (session.likedProductIds?.length)
    parts.push(
      `${en ? "Explicitly liked SKUs" : "明确喜欢的 SKU"}: ${ids(session.likedProductIds)}`,
    );
  if (session.skippedProductIds?.length)
    parts.push(
      `${en ? "Skip these SKUs" : "先略过的 SKU"}: ${ids(session.skippedProductIds)}`,
    );
  if (session.excludedKinds?.length)
    parts.push(
      `${en ? "Do not suggest new kinds" : "不推荐新增品类"}: ${session.excludedKinds.slice(0, 8).join(", ")}`,
    );
  if (session.excludedNewKinds?.length)
    parts.push(
      `${en ? "Use owned pieces for these kinds" : "这些品类先用已有物品"}: ${session.excludedNewKinds.slice(0, 8).join(", ")}`,
    );
  if (session.avoidedColors?.length)
    parts.push(
      `${en ? "Avoid suggested colours" : "不建议的配色"}: ${session.avoidedColors.slice(0, 8).join(", ")}`,
    );
  if (session.occasion)
    parts.push(
      `${en ? "Stated occasion" : "提到的场合"}: ${String(session.occasion).slice(0, 120)}`,
    );
  return parts.join("; ").slice(0, 500);
}
