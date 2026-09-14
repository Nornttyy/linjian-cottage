# Food system image generation prompts

## 最新状态（2026-09-14）

内置生图连接已恢复，16种新增食材及30种料理全部生成并接入。正式图片与完整提示词位于 `public/art/food-*.png` / `food-*.prompt.txt`；布局和逐格顺序见 `lib/food-art-layout.ts`，加载清单已更新。真实 PNG 透明通道、46个图标映射、裁切边界、全部回归测试、类型检查、lint、网页和服务端构建均通过。此版本的完整新版钓鱼及料理适用于“本机世界”；公开多人接口实测仅返回 `networkVersion: 2`，没有 `activityVersion: 2`，当前会话的 Sites 发布工具仍不可调用，因此多人后端未升级。以下保留历史故障记录，不代表当前素材状态。

## 历史记录

Built-in image_gen only. Ingredient atlas attempts: 3; full dish atlas attempts: 2; smaller four-sushi atlas attempts: 1. All six requests failed with `image generation failed: connection failed: error sending request`. No image output generated. No placeholder assets created; those attempts did not add or alter any sprite files.

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

2026-09-13：用户希望无需配置密钥的方式。最后一次缩小为四种寿司的2×2图集仍发生相同连接错误。只读连接检查确认本地代理端口可连接，但无法确认内置生图失败原因，没有修改网络设置。已向用户提出改由代码绘制正式像素PNG的可选方式，尚未获得该方式的回复，因此未制作替代图片、未发布缺失素材的版本。

钓鱼、料理、食材补给与背包代码已接入，但这两张图集未成功生成，未引用不存在的 PNG，也未填入占位素材。

后续拿到生成图片后，应按上述固定顺序裁切，在 `lib/art.ts` 加入图集加载并验证20食材、30料理每个单元的实际内容与透明边界。现有鲜鱼、胡萝卜、番茄、小麦图标保持原样；新增16食材与30料理需要对应的真实图标。

内置图片工具之外的 API 后备方案要求本机配置 `OPENAI_API_KEY`，并由用户明确选择启用；本机当前未配置。本次没有切换到该方式。

公开多人服务仍是旧版本；当前环境没有 Sites 发布工具。新版前端通过 `activityVersion: 2` 防止向旧服务发送不受支持的活动。主菜单“本机世界”可以运行完整新版规则。
## 2026-09-14 新会话复核

- 保留现有游戏代码、角色、场景及已有食材。本次只追加本节记录。
- 本次使用内置 `image_gen` 重试两次：四种生鱼食材的 2×2 小图集，以及单独一份三文鱼。两次均在约 3 秒后返回 `image generation failed: connection failed: error sending request`，没有返回图片或文件路径。累计已记录八次失败。
- 新增16种食材和30种料理共46个正式图标仍未生成，无法检查图案和透明边界。没有创建占位图，没有添加不存在的素材引用，没有调用需要 API 密钥的后备方式。
- 已检查 `lib/cooking.ts`：20种食材（含4种已有食材）、30种料理、最多5份食材的规则均在。背包、料理面板、食材兑换和钓鱼收获均通过 `ItemIcon` 使用物品 ID；缺口在 `lib/art.ts` 的真实图标加载和分配，以及 `lib/asset-loading.ts` 的素材清单。
- `npm test` 全部通过（日志含687条 PASS），`npx tsc --noEmit`、`npm run build:pages` 和 `npm run build` 均通过。这些验证不代表缺失图标已完成，也不包含新版浏览器视觉验收。
- 已联网只读确认 GitHub 登录及 Pages 发布通道可用。远端 `main` 仍是 `9a332be`，`gh-pages` 是 `ab4c46c`（发布自 `9a332be`）；本机钓鱼料理代码提交 `3e70015` 尚未上传。
- 多人服务检查：对现有 `/api/game` 发出不创建或修改房间的版本探测，返回 Cloudflare HTTP 403 拦截页，无法确认当前线上协议版本。本会话可用工具列表不包含 Sites 发布能力，因此未更新多人后端。不能将历史记录中的旧服务状态当成本次实测结果。
- 现有本机模式的新版规则通过测试，但新增图标仍为空缺；没有发布本机玩法版本，也没有更新线上网站。待内置生图服务恢复、46个正式图标生成并完成接入和视觉检查后，再使用现有授权上传发布，无需重复询问公开发布许可。

### 本次实际提交给内置图片工具的提示词

#### 尝试1：四格食材图集

Use case: stylized-concept. Asset type: production-ready pixel art ingredient sprite atlas for a warm healing pastoral building game. Create a new square PNG with genuinely transparent alpha background. Exactly FOUR separate icons in a strict 2-column by 2-row grid, centered at (25%,25%), (75%,25%), (25%,75%), (75%,75%). Each icon stays within the middle 60% of its cell with generous transparent margins. Top left: raw salmon fillet, coral orange with a few broad cream fat stripes. Top right: raw salmon belly cut, pale coral with visibly wider cream stripes. Bottom left: raw extra-fatty salmon belly, mostly creamy pale peach with sparse orange stripes. Bottom right: raw lean tuna cut, saturated but moderate deep rose red, no white fat marbling. Uncooked ingredients, no plates, no faces, no text or labels. Coarse, regular square pixel art, only 24–32 pixels of detail per icon, enlarged with nearest-neighbor, crisp stepped edges and simple 3–5 shade clusters. Warm creamy highlights, softened brown outlines, moderate saturation. No large dark areas, no fine texture, no smooth gradients, no antialiasing, no 3D, no photorealism, no excessive cartoon styling. All four foods must be easy to distinguish and wholly inside their own cells. Background must be real transparency, never checkerboard or colored fill.

#### 尝试2：单个三文鱼图标

Create one production game inventory icon: a raw coral-orange salmon fillet with three broad cream stripes, centered, fully visible, with generous empty margins on a genuinely transparent PNG background. Warm, healing, simple pixel art made of clear regular square pixels, 24–32 pixels of detail enlarged with nearest-neighbor. Moderate saturation, creamy highlights, soft brown outlines. No dark background, no fine texture, no smooth gradients, no antialiasing, no plate, no text, no face, no checkerboard. This must be a single finished salmon ingredient sprite.

### 同日连接排查

- 应用日志同时记录 `codex_apps` 初始化连接 `https://chatgpt.com/backend-api/ps/mcp` 失败、插件目录请求失败和请求超时，因此当前缺少 Sites 工具可能与连接问题有关，不能据此断定用户没有安装或授权 Sites。
- 无凭证连接探测：直连 `https://chatgpt.com/` 约5秒连接超时；通过已有本机代理返回 HTTP 403；相同代理能读取 OpenAI 官方排障文档。403只代表此次请求被拒绝，不能单凭此结果确定登录会话、生图服务或代理节点的具体故障原因。
- 本次仅做只读检查；未修改代理、系统网络、应用配置或账户凭证，也未重启应用。下一步优先恢复应用到 ChatGPT 工具服务的连接，再重新加载工具并尝试单张正式食材图。GitHub 发布通道仍无需额外配置。

### 用户再次“继续”后的复测与源码上传

- 内置工具再次提交单张正式三文鱼图，采用上述单图要求并强调主体占画布约65%；请求等待数分钟后仍返回相同连接错误，未生成文件。累计记录九次失败，46个正式新图标依然缺失。
- 开始时工具列表曾出现 Sites 能力，但随后从可用列表中消失；最新日志确认 `codex_apps` 初始化再次超时。因此工具名称暂时出现不等于发布服务已经恢复。
- 已通过本机现有代理成功上传已验证的源码提交 `3e70015377bb93cf9f3b732643fbd41008786800` 到现有 GitHub 仓库 `main`，并用 GitHub 接口复核。`gh-pages` 仍为 `ab4c46cd75bab367ae6df94a4dd35a057e6041c8`，线上网站没有更新，多人服务没有更新。
- 在沙箱外只读检查确认系统 HTTP/HTTPS/SOCKS 代理均关闭。直接指定现有本机代理访问日志中的插件服务地址，可收到 HTTP 451 JSON（`no_biscuit_no_service`），只说明这次无凭证请求收到了服务响应，不能将其认作已认证服务可用或地区限制的证据。应用内部已认证请求仍超时，可能存在网络路径差异；尚未修改任何系统代理设置。
