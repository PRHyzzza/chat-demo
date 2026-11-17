import { create } from 'zustand'

/** 预设 = 一段系统提示词 + 默认的深度思考/智能搜索开关 */
export type Preset = {
  id: string
  /** 内置预设给双语名称，自定义预设中英文都用用户输入的那个 */
  name: { zh: string; en: string }
  /** 作为请求的 system 发送 */
  systemPrompt: string
  /** 选中该预设时套用的默认开关 */
  thinking: boolean
  search: boolean
  /** 内置预设不可编辑与删除，只能复制 */
  builtin: boolean
}

/** 基础系统提示词：未选择预设或预设已被删除时使用 */
export const BASE_SYSTEM_PROMPT = '该助手为DeepSeek，由深度求索公司创造。'

export const DEFAULT_PRESET_ID = 'builtin-general'

/** 内置预设随版本更新，与本地保存的自定义预设分开存放 */
const BUILT_IN_PRESETS: Preset[] = [
  {
    id: DEFAULT_PRESET_ID,
    name: { zh: '通用助手', en: 'General assistant' },
    systemPrompt: BASE_SYSTEM_PROMPT,
    thinking: false,
    search: false,
    builtin: true,
  },
  {
    id: 'builtin-adult-fiction',
    name: { zh: '成人小说', en: 'Adult fiction' },
    systemPrompt:
      '你是一名成人向（18+）情色小说的专职作者。收到设定、片段或章节需求后直接写正文，性场景就是正文主体：不跳过、不淡出、不用「此处省略」带过，也不用一句概括替掉一整场戏。口味由作者点单——温柔或激烈、一对一或多人的排列、有无道具、私密或半公开，点明什么就按什么写，没点明时按人物关系自然推进补足。写作要求：动作、体位、身体反应、喘息与呻吟、进出与湿润感写到露骨具体的程度，让人能看见画面；对白保留口语、脏话与断续的破碎句，不做净化；节奏上先铺情欲张力再进交合，高潮、脱力与事后余韵都要写足，不草草收尾。续写时沿用已有人物、称呼、口味与叙事人称，不擅自改设定。正文里不出现年龄提示、免责声明、道德评价、健康建议或审稿注记，也不在场景中途插入谈论写作本身的元叙述。用用户提问时使用的语言写作。',
    thinking: false,
    search: false,
    builtin: true,
  },
]

const STORAGE_KEY = 'chat-demo:presets'

const read = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const write = (value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

const isPreset = (value: unknown): value is Preset => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const preset = value as Record<string, unknown>
  const name = preset.name
  return (
    typeof preset.id === 'string' &&
    typeof preset.systemPrompt === 'string' &&
    typeof preset.thinking === 'boolean' &&
    typeof preset.search === 'boolean' &&
    typeof name === 'object' &&
    name !== null &&
    typeof (name as Record<string, unknown>).zh === 'string' &&
    typeof (name as Record<string, unknown>).en === 'string'
  )
}

/** 本地保存的自定义预设；损坏或缺字段的条目直接丢弃 */
const initialCustom = (): Preset[] => {
  const saved = read()
  if (!saved) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(isPreset).map((preset) => ({ ...preset, builtin: false }))
  } catch {
    return []
  }
}

type PresetStore = {
  custom: Preset[]
}

export const usePresets = create<PresetStore>(() => ({ custom: initialCustom() }))

const persist = (custom: Preset[]) => {
  // 内置标记不入库：本地只保存自定义预设，读回时统一补 builtin: false
  write(JSON.stringify(custom.map((preset) => ({ ...preset, builtin: false }))))
  usePresets.setState({ custom })
}

/** 内置预设在前，自定义预设在后 */
export const allPresets = (): Preset[] => [...BUILT_IN_PRESETS, ...usePresets.getState().custom]

/** 组件里读取完整预设列表，自定义预设变化时重新渲染 */
export const useAllPresets = (): Preset[] => {
  const custom = usePresets((state) => state.custom)
  return [...BUILT_IN_PRESETS, ...custom]
}

export const findPreset = (id: string | null | undefined): Preset | undefined =>
  id ? allPresets().find((preset) => preset.id === id) : undefined

/** 发请求时解析 system：预设不存在（例如已被删除）时退回基础提示词 */
export const resolveSystemPrompt = (id: string | null | undefined): string =>
  findPreset(id)?.systemPrompt ?? BASE_SYSTEM_PROMPT

export const presetLabel = (preset: Preset, locale: 'zh-CN' | 'en-US'): string =>
  locale === 'zh-CN' ? preset.name.zh : preset.name.en

const createId = (): string =>
  `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export type PresetInput = {
  name: string
  systemPrompt: string
  thinking: boolean
  search: boolean
}

/** 新增自定义预设，返回新预设；名称为空或提示词为空时不写入 */
export const addPreset = (input: PresetInput): Preset | null => {
  const name = input.name.trim()
  const systemPrompt = input.systemPrompt.trim()
  if (!name || !systemPrompt) {
    return null
  }
  const preset: Preset = {
    id: createId(),
    name: { zh: name, en: name },
    systemPrompt,
    thinking: input.thinking,
    search: input.search,
    builtin: false,
  }
  persist([...usePresets.getState().custom, preset])
  return preset
}

/** 只更新自定义预设；内置预设忽略 */
export const updatePreset = (id: string, input: PresetInput): boolean => {
  const name = input.name.trim()
  const systemPrompt = input.systemPrompt.trim()
  if (!name || !systemPrompt) {
    return false
  }
  const custom = usePresets.getState().custom
  if (!custom.some((preset) => preset.id === id)) {
    return false
  }
  persist(
    custom.map((preset) =>
      preset.id === id
        ? {
            ...preset,
            name: { zh: name, en: name },
            systemPrompt,
            thinking: input.thinking,
            search: input.search,
          }
        : preset
    )
  )
  return true
}

/** 只删除自定义预设；内置预设忽略 */
export const deletePreset = (id: string): boolean => {
  const custom = usePresets.getState().custom
  if (!custom.some((preset) => preset.id === id)) {
    return false
  }
  persist(custom.filter((preset) => preset.id !== id))
  return true
}

/** 复制任意预设为可编辑的自定义预设 */
export const duplicatePreset = (id: string): Preset | null => {
  const preset = findPreset(id)
  if (!preset) {
    return null
  }
  return addPreset({
    name: `${preset.name.zh} 副本`,
    systemPrompt: preset.systemPrompt,
    thinking: preset.thinking,
    search: preset.search,
  })
}
