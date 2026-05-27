export interface PromptTemplate {
  id: string
  title: string
  category: string
  tags: string[]
  genre: string
  style: string
  corePlot: string
  characters: string
  other: string
  wordCount: string
  reason: string
}

export const PROMPT_TEMPLATES_UPDATED_AT = '2026-05-02'

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'system-apocalypse-management',
    title: '末世经营 + 系统流爽文',
    category: '男频爽文',
    tags: ['末世', '系统', '经营', '打脸', '升级'],
    genre: '科幻',
    style: '紧张爽快',
    corePlot: '主角在末世觉醒经营系统，把废弃便利店改造成安全基地。第一章需要快速建立危机、展示系统能力，并用一次反差打脸证明主角价值。',
    characters: '主角冷静务实，擅长资源管理；女配是战斗力强但缺乏安全感的幸存者；反派是贪婪的临时营地头目。',
    other: '开头 500 字内出现强冲突；中段展示系统规则；结尾留下更大危机钩子。',
    wordCount: '2000',
    reason: '末世、系统、经营是 AI 漫剧和男频爽文的高频组合，适合强冲突和连续追更。'
  },
  {
    id: 'weird-zero-yuan-purchase',
    title: '全民诡异 + 零元购能力',
    category: '诡异怪谈',
    tags: ['诡异', '规则怪谈', '系统', '猎奇', '反转'],
    genre: '悬疑',
    style: '神秘惊悚',
    corePlot: '世界进入全民诡异副本，主角获得“零元购”能力，可以无视规则取走关键道具。章节围绕第一次副本展开，既要恐怖压迫，也要爽点反转。',
    characters: '主角表面胆小但观察力极强；诡异管理员冷漠机械；同行者中有人隐藏恶意。',
    other: '保持规则清晰，不要过度解释；每 800 字制造一次危险升级。',
    wordCount: '2000',
    reason: '诡异 + 系统流是近期漫剧和网文的爆款组合，天然适合悬念和反转。'
  },
  {
    id: 'female-rebirth-career',
    title: '女频重生 + 事业成长',
    category: '女频成长',
    tags: ['重生', '女性成长', '职场', '复仇', '自我实现'],
    genre: '都市',
    style: '克制有力',
    corePlot: '女主重生回到被背叛前夕，这一次不再恋爱脑，而是抢先布局事业与证据链。章节要体现独立成长、情绪自主和第一波反击。',
    characters: '女主清醒坚韧，前世受害但不卖惨；男配尊重女主边界；反派是擅长情绪操控的前任。',
    other: '避免虐女叙事；重点写女主掌控局面与自我价值实现。',
    wordCount: '2000',
    reason: '女性成长、职场逆袭和重生复仇正在替代单一甜宠，适合更立体的人设。'
  },
  {
    id: 'contract-marriage-power-couple',
    title: '先婚后爱 + 势均力敌',
    category: '都市甜宠',
    tags: ['先婚后爱', '契约婚姻', '霸总', '势均力敌', '甜宠'],
    genre: '言情',
    style: '浪漫张力',
    corePlot: '女主为保护家族项目与男主签下契约婚姻，但她并非弱者，而是带着自己的商业筹码入局。章节重点写初次交锋和暧昧张力。',
    characters: '女主聪明强势但有底线；男主冷静克制、控制欲强；双方都不轻易低头。',
    other: '避免傻白甜；对话要有锋芒；结尾用一个误会或利益冲突制造追读。',
    wordCount: '2000',
    reason: '先婚后爱仍是稳定题材，加入女性主动权和势均力敌更符合新趋势。'
  },
  {
    id: 'palace-rebirth-scheme',
    title: '宫斗重生 + 让位反杀',
    category: '古风权谋',
    tags: ['宫斗', '重生', '权谋', '反杀', '女性成长'],
    genre: '历史',
    style: '冷静权谋',
    corePlot: '女主重生回选秀前夜，故意把人人看重的机会让给仇敌，暗中改走另一条权力路线。章节要展示她对前世信息的利用。',
    characters: '女主外柔内狠；仇敌自负贪婪；关键男角色身份暧昧，暂不完全可信。',
    other: '用细节体现权谋，不要直接解释全部计划；结尾让读者意识到女主还有后手。',
    wordCount: '3000',
    reason: '宫斗、重生、女性掌控命运仍是女频高黏性题材。'
  },
  {
    id: 'furry-folk-myth',
    title: '本土志怪 + 福瑞/兽耳脑洞',
    category: '奇幻脑洞',
    tags: ['志怪', '福瑞', '兽耳', '讨封', '奇幻脑洞'],
    genre: '玄幻',
    style: '轻奇幻',
    corePlot: '主角夜路遇到黄皮子讨封，对方却化成金发兽耳少女。章节需要融合本土民俗恐怖与年轻化萌点，形成反差吸引力。',
    characters: '主角嘴硬心软；黄皮子少女傲娇危险；村中老人知道部分禁忌。',
    other: '前半段保留民俗惊悚氛围，后半段用反差萌和契约关系转爽点。',
    wordCount: '2000',
    reason: 'AI 漫剧中福瑞/兽耳与本土志怪结合正在形成差异化脑洞。'
  },
  {
    id: 'myth-remix-system',
    title: '神话二创 + 代管宗门系统',
    category: '玄幻仙侠',
    tags: ['封神', '西游', '洪荒', '系统', '宗门经营'],
    genre: '仙侠',
    style: '热血爽快',
    corePlot: '主角穿到神话世界，绑定代管宗门系统，误打误撞把一群普通弟子培养成大能。章节重点写第一次“无心插柳”的高能误会。',
    characters: '主角谨慎但被外界误认为高深莫测；弟子们脑补能力强；老牌强者暗中观察。',
    other: '多用反差和误会制造爽点；保留神话设定但不要照搬原著。',
    wordCount: '3000',
    reason: '成熟 IP 底本 + 系统经营能降低理解门槛，适合长篇扩展。'
  },
  {
    id: 'silver-age-family',
    title: '银发家庭 + 现实反转',
    category: '现实情感',
    tags: ['银发题材', '家庭伦理', '现实', '反转', '治愈'],
    genre: '都市',
    style: '现实温情',
    corePlot: '退休母亲发现自己多年付出被家人视为理所当然，于是重新学习直播带货和法律维权。章节要有现实痛点、情绪共鸣和第一次反转。',
    characters: '母亲温和但逐渐觉醒；子女自私但不脸谱化；邻居是关键助力。',
    other: '避免狗血过量；情绪要真实；爽点来自尊严恢复和关系重建。',
    wordCount: '2000',
    reason: '短剧市场正在拓展银发和家庭现实题材，适合大众向受众。'
  }
]
