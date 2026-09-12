import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'


interface Common {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
  className?: string
}

type AsButton = Common &
  ButtonHTMLAttributes<HTMLButtonElement> & { to?: never; href?: never }
type AsLink = Common & { to: string; href?: never }
type AsAnchor = Common &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; to?: never }

type ButtonProps = AsButton | AsLink | AsAnchor

function classes(variant: ButtonVariant, size: ButtonSize, extra?: string) {
  return ['btn', `btn--${variant}`, `btn--${size}`, extra].filter(Boolean).join(' ')
}

/**
 * One button, three shapes: a real <button>, an internal <Link>, or an external
 * <a>. Which one you get depends on whether you pass `to` or `href`, so links
 * stay links and keyboard/middle-click behaviour is never faked.
 */
export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', className, children } = props

  if ('to' in props && props.to !== undefined) {
    const { to } = props
    return (
      <Link to={to} className={classes(variant, size, className)}>
        {children}
      </Link>
    )
  }

  if ('href' in props && props.href !== undefined) {
    const { href, ...rest } = props as AsAnchor
    const external = /^https?:/i.test(href)
    return (
      <a
        {...rest}
        href={href}
        className={classes(variant, size, className)}
        {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      >
        {children}
      </a>
    )
  }

  const { ...rest } = props as AsButton
  return (
    <button {...rest} type={rest.type ?? 'button'} className={classes(variant, size, className)}>
      {children}
    </button>
  )
}
