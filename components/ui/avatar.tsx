import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar'

import { cn } from '@/lib/utils'

/**
 * Every user avatar in this app today is initials-on-a-colored-circle
 * (`style={{ backgroundColor: color }}`), written inline per-component with
 * slightly different sizes. This wraps that same pattern as one component
 * so size/shape stay consistent; real photo support (`AvatarImage`) is
 * available for later without another rewrite.
 */
function Avatar({ className, ...props }: AvatarPrimitive.Root.Props) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return <AvatarPrimitive.Image data-slot="avatar-image" className={cn('size-full object-cover', className)} {...props} />
}

function AvatarFallback({
  className,
  style,
  color,
  ...props
}: AvatarPrimitive.Fallback.Props & { color?: string }) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      style={color ? { backgroundColor: color, ...style } : style}
      className={cn('flex size-full items-center justify-center rounded-full bg-muted text-sm font-bold text-white', className)}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
