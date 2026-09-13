# Food system image generation prompts

Built-in image_gen only. Ingredient attempts: 2; dish attempts: 1. All three requests failed with `image generation failed: connection failed: error sending request`. No image output generated. No placeholder assets created; those attempts did not add or alter any sprite files.

## Ingredients, 5 columns × 4 rows

Use case: stylized-concept.
Asset type: production-ready pixel-art inventory ingredient sprite atlas for a warm pastoral 2D building game.
Create a NEW 1024x1024 PNG with genuinely transparent background and exactly twenty separate icons in a strict 5-column by 4-row regular layout. No grid lines, no cell border, no text, no labels, no decorative background. Equal cells, centers at columns 10%,30%,50%,70%,90% and rows 12.5%,37.5%,62.5%,87.5%. Keep each icon within 65% of cell width and height with a generous empty transparent margin. No icon touches its neighbor.
Style: clear coarse pixel art with a regular square pixel grid, icons should look natively drawn with only 24–32 pixels of detail each then enlarged with nearest-neighbor. Crisp stepped edges, large simple color clusters, 3–5 shades per material, no anti-aliasing, no gradients, no tiny texture. Warm clear colors with moderate saturation, creamy highlights, softened warm-brown outlines rather than black. Bright salmon coral, tuna rose, spring green, golden wheat. Existing game has chunky regular pixels, warm gold wooden objects and clean readable item silhouettes. Not photorealistic, not 3D renders, not smooth vector art, no cartoon faces or emotional expressions.
All food is uncooked ingredient, consistent game inventory view with only a slight top view, centered; no plate unless a plain rice bowl is necessary.
EXACT CONTENT ORDER left to right row by row:
Row 1: (1) small ordinary whole silver-blue freshwater fish, (2) single orange carrot with green leaves, (3) single red tomato with green stem, (4) tied small bundle golden wheat, (5) fresh salmon fillet coral orange with a few cream fat stripes.
Row 2: (6) salmon belly cut pale coral with broad cream stripes, (7) extra-fatty salmon belly mostly creamy pale peach with sparse orange stripes, (8) lean tuna cut deep rose red, (9) tuna belly pink with cream marbling, (10) extra-fatty tuna belly pale pink creamy marbling.
Row 3: (11) small raw sweet shrimp light pink with shell and tail, (12) large raw sweet shrimp visibly plumper and longer with large tail, (13) three lobes golden orange sea-urchin roe, (14) mound of cooked white rice in a tiny plain cream bowl, (15) folded square sheet of seaweed muted forest green.
Row 4: (16) two cream-colored chicken eggs, (17) raw wagyu beef steak rose pink with coarse cream marbling, (18) small plain bottle of golden cooking oil with no label, (19) small pile of white sugar cubes, (20) small plain glass bottle of milk with cream cap and no label.
The 20 ingredients must be visually distinguishable, silhouettes fully contained in assigned cells. Real alpha transparency, NOT checkerboard or magenta fill.

## Dishes, 5 columns × 6 rows

Use case: stylized-concept.
Asset type: production-ready pixel-art cooked dish inventory sprite atlas for a warm pastoral 2D building game.
Create a NEW 1024x1024 PNG with genuinely transparent background and exactly thirty separate icons in a strict 5-column by 6-row regular layout. No grid lines, no cell borders, no text, no labels, no decorative background. Equal cells, centers at columns 10%,30%,50%,70%,90% and rows 8.333%,25%,41.667%,58.333%,75%,91.667%. Each icon is centered within its assigned cell and occupies no more than 65% cell width or height. Generous transparent margins; icons must never touch one another.
Coarse pixel art with a regular square pixel grid, icons should look natively drawn with only 24–32 pixels of detail each, enlarged nearest-neighbor. Crisp stepped edges, large simple color clusters, 3–5 shades per material, no anti-aliasing, no gradients, no tiny texture. Warm clear colors, moderate saturation, creamy highlights and warm-brown outlines rather than black. Existing game uses chunky regular pixels and warm gold wooden objects. No photorealism, no 3D renders, no smooth vector art, no cartoon faces.
Serve each dish on the same small shallow cream ceramic plate. Food occupies most of plate and is easily distinguishable. Consistent game inventory view, slight top view only. No garnish except listed main ingredients, no cutlery.
EXACT ORDER left to right, row by row:
Row 1:
1. whole golden grilled fish with simple brown grill marks;
2. roasted vegetables, orange carrot and red tomato;
3. thick-cut grilled wagyu steak, warm brown edges and rosy center;
4. two orange-pink whole grilled shrimp with shells;
5. one rectangular golden pan-fried fish fillet.
Row 2:
6. three yellow tamagoyaki rolled omelette slices;
7. pan-seared wagyu, several small sliced steak pieces;
8. garden fried rice, cream rice mixed orange carrot, red tomato and yellow egg;
9. battered deep-fried fish, long golden crispy fish pieces;
10. two golden battered fried shrimp with red tail tips.
Row 3:
11. vegetable tempura, a fan of pale golden battered vegetable slices;
12. two round crispy orange carrot fritters;
13. one small golden milk bread roll with a creamy split top;
14. triangular carrot cake slice, orange cake and white cream top;
15. cream-white milk pudding with a small caramel cap.
Row 4:
16. pale yellow square milk cake;
17. one sea-urchin sushi gunkan, muted dark-green seaweed around golden orange roe;
18. one salmon nigiri sushi, white rice under coral-orange striped fish;
19. one tuna nigiri sushi, white rice under rosy-red fish;
20. one tamagoyaki nigiri sushi, white rice under a yellow omelette block secured with a green seaweed band.
Row 5:
21. one wagyu nigiri sushi, white rice under warm brown and pink beef;
22. one sweet shrimp nigiri sushi, white rice under two pale pink shrimp tails;
23. salmon sashimi, three coral-orange slices with thin cream stripes;
24. salmon belly sashimi, three pale orange slices with wider cream stripes;
25. extra-fatty salmon belly sashimi, three mostly cream peach slices with sparse orange stripes.
Row 6:
26. lean tuna sashimi, three rosy-red slices;
27. tuna belly sashimi, three pink slices with cream marbling;
28. extra-fatty tuna belly sashimi, three pale pink and cream slices;
29. small sweet shrimp sashimi, two small translucent pale pink peeled shrimp;
30. large sweet shrimp sashimi, one noticeably larger plump pale pink peeled shrimp.
Keep all thirty fully separate and in this exact order. Real alpha transparency, NOT checkerboard or magenta fill.

## 当前集成状态

钓鱼、料理、食材补给与背包代码已接入，但这两张图集未成功生成，未引用不存在的 PNG，也未填入占位素材。

后续拿到生成图片后，应按上述固定顺序裁切，在 `lib/art.ts` 加入图集加载并验证20食材、30料理每个单元的实际内容与透明边界。现有鲜鱼、胡萝卜、番茄、小麦图标保持原样；新增16食材与30料理需要对应的真实图标。

内置图片工具之外的 API 后备方案要求本机配置 `OPENAI_API_KEY`，并由用户明确选择启用；本机当前未配置。本次没有切换到该方式。

公开多人服务仍是旧版本；当前环境没有 Sites 发布工具。新版前端通过 `activityVersion: 2` 防止向旧服务发送不受支持的活动。主菜单“本机世界”可以运行完整新版规则。
