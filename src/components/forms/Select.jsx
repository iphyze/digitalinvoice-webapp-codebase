import { useId, useMemo } from 'react'
import ReactSelect, { components as selectParts } from 'react-select'
import AsyncSelect from 'react-select/async'
import { Check, ChevronDown, X } from 'lucide-react'
import styles from './Select.module.css'


// Render a real icon in a separate layout column, rather than appending a
// checkmark to the selected label through a pseudo-element.
function MenuOption(props) {
  return (
    <selectParts.Option {...props}>
      <span className={styles.optionContent}>
        <span className={styles.optionLabel}>{props.children}</span>
        {props.isSelected && <Check className={styles.optionCheck} size={16} aria-hidden="true" />}
      </span>
    </selectParts.Option>
  )
}

/**
 * Select field on react-select, styled with design tokens (unstyled + classNames),
 * so it matches TextField in both themes. The menu renders into document.body,
 * so modals/drawers cannot clip it; its viewport-positioned portal sits
 * above overlay backdrops and uses the shared pop-in motion.
 *
 * value / onChange work with plain values ('11-50 employees'), not option objects.
 *   options      [{ value, label }]
 *   isMulti      value is an array
 *   isClearable  shows a clear button
 *   loadOptions  async search (inputValue) => Promise<options>; uses AsyncSelect
 *   label, icon, hint, error, placeholder, isDisabled, isSearchable, id, name
 */
export default function Select({
  label, icon: Icon, hint, error, options = [], value, onChange, isMulti = false,
  isClearable = false, isSearchable = false, loadOptions, placeholder = 'Select…', id,
  className = '', size = 'md', noOptionsMessage, ...rest
}) {
  const autoId = useId()
  const inputId = id || autoId
  const messageId = `${inputId}-message`
  const message = error || hint

  const selected = useMemo(() => {
    if (isMulti) return options.filter((o) => (value || []).includes(o.value))
    return options.find((o) => o.value === value) || null
  }, [isMulti, options, value])

  const handleChange = (option) => {
    if (isMulti) onChange?.((option || []).map((o) => o.value))
    else onChange?.(option ? option.value : '')
  }

  const Component = loadOptions ? AsyncSelect : ReactSelect
  const asyncProps = loadOptions ? { loadOptions, defaultOptions: true, cacheOptions: true } : { options }

  return (
    <div className={`${styles.field} ${className}`}>
      {label ? <label htmlFor={inputId} className={styles.label}>{label}</label> : null}
      <div className={styles.wrap} data-size={size} data-has-icon={Icon ? '' : undefined} data-invalid={error ? '' : undefined}>
        {Icon ? <Icon size={17} className={styles.icon} aria-hidden="true" /> : null}
        <Component
          inputId={inputId}
          unstyled
          value={loadOptions ? value : selected}
          onChange={loadOptions ? onChange : handleChange}
          isMulti={isMulti}
          isClearable={isClearable}
          isSearchable={isSearchable || Boolean(loadOptions)}
          placeholder={placeholder}
          menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
          menuPosition="fixed"
          menuPlacement="auto"
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          noOptionsMessage={noOptionsMessage || (() => 'No options')}
          components={{
            Option: MenuOption,
            DropdownIndicator: () => <ChevronDown size={17} className={styles.chevron} aria-hidden="true" />,
            ClearIndicator: (props) => (
              <span {...props.innerProps} className={styles.clear} aria-hidden="true"><X size={15} /></span>
            ),
            IndicatorSeparator: null,
          }}
          classNames={{
            container: () => styles.container,
            control: ({ isFocused }) => `${styles.control} ${isFocused ? styles.focused : ''}`,
            valueContainer: () => styles.valueContainer,
            placeholder: () => styles.placeholder,
            singleValue: () => styles.singleValue,
            multiValue: () => styles.multiValue,
            multiValueLabel: () => styles.multiValueLabel,
            multiValueRemove: () => styles.multiValueRemove,
            input: () => styles.input,
            indicatorsContainer: () => styles.indicators,
            menuPortal: () => styles.menuPortal,
            menu: () => `${styles.menu} fx-pop`,
            menuList: () => styles.menuList,
            option: ({ isFocused, isSelected }) => `${styles.option} ${isFocused ? styles.optionFocused : ''} ${isSelected ? styles.optionSelected : ''}`,
            noOptionsMessage: () => styles.empty,
            loadingMessage: () => styles.empty,
          }}
          {...asyncProps}
          {...rest}
        />
      </div>
      {message ? <p id={messageId} className={error ? styles.error : styles.hint} role={error ? 'alert' : undefined}>{message}</p> : null}
    </div>
  )
}
