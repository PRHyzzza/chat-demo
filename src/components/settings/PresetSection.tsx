import clsx from 'clsx'
import { useState } from 'react'
import {
  IconCopyOutline16,
  IconEditOutline16,
  IconPresetOutline16,
  IconTrashOutline16,
} from '../base/icons.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { useTranslate } from '../../i18n/index.js'
import {
  DEFAULT_PRESET_ID,
  addPreset,
  deletePreset,
  duplicatePreset,
  presetLabel,
  updatePreset,
  useAllPresets,
  type Preset,
} from '../../services/presets.js'
import { selectPreset, setPresetId, useSettings } from '../../services/settings.js'
import styles from './PresetSection.module.css'

/**
 * AI 预设：一段系统提示词加一套默认开关。
 * 内置预设只能查看与复制，自定义预设可编辑删除；点条目即切换为当前预设。
 */
export const PresetSection = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const presetId = useSettings((state) => state.presetId)
  const presets = useAllPresets()
  /** 'new' 表示新建，Preset 表示编辑，null 表示关闭编辑器 */
  const [editing, setEditing] = useState<Preset | 'new' | null>(null)
  const [removing, setRemoving] = useState<Preset | null>(null)

  const copy = (preset: Preset) => {
    if (duplicatePreset(preset.id)) {
      showToast(t('presetSaved'))
    }
  }

  const confirmRemove = (preset: Preset) => {
    deletePreset(preset.id)
    if (presetId === preset.id) {
      setPresetId(DEFAULT_PRESET_ID)
    }
    setRemoving(null)
    showToast(t('presetDeleted'))
  }

  return (
    <>
      <div className={styles.header}>
        <div className={styles.description}>{t('presetSectionDescription')}</div>
        <Button
          variant="outlined"
          size="m"
          className={styles.newButton}
          onClick={() => setEditing('new')}
        >
          {t('presetNew')}
        </Button>
      </div>
      <div className={styles.list}>
        {presets.map((preset) => {
          const active = preset.id === presetId
          return (
            <div key={preset.id} className={clsx(styles.item, active && styles.itemActive)}>
              <button
                type="button"
                className={styles.itemMain}
                aria-pressed={active}
                onClick={() => selectPreset(preset.id)}
              >
                <span className={styles.itemTitle}>
                  <IconPresetOutline16 />
                  <span className={styles.itemName}>{presetLabel(preset, locale)}</span>
                  {preset.builtin ? <span className={styles.tag}>{t('presetBuiltin')}</span> : null}
                  {active ? <span className={styles.tagActive}>{t('presetCurrent')}</span> : null}
                </span>
                <span className={styles.itemPrompt}>{preset.systemPrompt}</span>
              </button>
              <div className={styles.itemActions}>
                <IconButton
                  icon={<IconCopyOutline16 />}
                  tooltip={t('presetDuplicate')}
                  onClick={() => copy(preset)}
                />
                {preset.builtin ? null : (
                  <>
                    <IconButton
                      icon={<IconEditOutline16 />}
                      tooltip={t('presetEdit')}
                      onClick={() => setEditing(preset)}
                    />
                    <IconButton
                      icon={<IconTrashOutline16 />}
                      tooltip={t('presetDelete')}
                      onClick={() => setRemoving(preset)}
                    />
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {editing ? <PresetEditor preset={editing} onClose={() => setEditing(null)} /> : null}
      {removing ? (
        <Modal
          title={t('presetDeleteConfirmTitle')}
          className={styles.confirm}
          onClose={() => setRemoving(null)}
          footer={
            <div className={styles.confirmActions}>
              <Button variant="outlined" size="m" autoFocus onClick={() => setRemoving(null)}>
                {t('cancel')}
              </Button>
              <Button variant="danger" size="m" onClick={() => confirmRemove(removing)}>
                {t('presetDelete')}
              </Button>
            </div>
          }
        >
          <div className={styles.confirmText}>{t('presetDeleteConfirmDescription')}</div>
        </Modal>
      ) : null}
    </>
  )
}

/** 新建与编辑共用同一个表单；内置预设的编辑由调用方拦住，不会进来 */
const PresetEditor = ({ preset, onClose }: { preset: Preset | 'new'; onClose: () => void }) => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const creating = preset === 'new'
  const [name, setName] = useState(() => (creating ? '' : presetLabel(preset, locale)))
  const [systemPrompt, setSystemPrompt] = useState(creating ? '' : preset.systemPrompt)
  const [thinking, setThinking] = useState(creating ? false : preset.thinking)
  const [search, setSearch] = useState(creating ? false : preset.search)

  const submit = () => {
    const input = { name, systemPrompt, thinking, search }
    if (creating) {
      const created = addPreset(input)
      if (!created) {
        showToast(t('presetInvalid'))
        return
      }
      selectPreset(created.id)
    } else if (!updatePreset(preset.id, input)) {
      showToast(t('presetInvalid'))
      return
    }
    showToast(t('presetSaved'))
    onClose()
  }

  return (
    <Modal
      title={t(creating ? 'presetCreateTitle' : 'presetEditTitle')}
      className={styles.editor}
      onClose={onClose}
      footer={
        <div className={styles.confirmActions}>
          <Button variant="outlined" size="m" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" size="m" onClick={submit}>
            {t('confirm')}
          </Button>
        </div>
      }
    >
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="preset-name">
          {t('presetNameLabel')}
        </label>
        <input
          id="preset-name"
          className={styles.input}
          value={name}
          maxLength={40}
          placeholder={t('presetNamePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="preset-prompt">
          {t('presetPromptLabel')}
        </label>
        <textarea
          id="preset-prompt"
          className={clsx(styles.input, styles.textarea)}
          value={systemPrompt}
          rows={7}
          spellCheck={false}
          placeholder={t('presetPromptPlaceholder')}
          onChange={(event) => setSystemPrompt(event.target.value)}
        />
      </div>
      <div className={styles.switches}>
        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={thinking}
            onChange={(event) => setThinking(event.target.checked)}
          />
          <span>{t('presetThinkingLabel')}</span>
        </label>
        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={search}
            onChange={(event) => setSearch(event.target.checked)}
          />
          <span>{t('presetSearchLabel')}</span>
        </label>
      </div>
    </Modal>
  )
}
