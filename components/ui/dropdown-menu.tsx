'use client'

import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { cn } from '@/lib/utils'

function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({ className, ...props }: MenuPrimitive.Trigger.Props) {
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      className={cn('outline-none', className)}
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = 'end',
  ...props
}: MenuPrimitive.Popup.Props & Pick<MenuPrimitive.Positioner.Props, 'sideOffset' | 'align'>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={sideOffset} align={align} className="z-50 outline-none">
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'min-w-[220px] overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-xl shadow-black/[0.06] outline-none',
            'data-open:animate-scale-in data-open:origin-[var(--transform-origin)]',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors data-highlighted:bg-muted',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<'div'>) {
  // A plain label, not `Menu.GroupLabel` — that primitive throws unless it's
  // rendered inside a `Menu.Group`, which we don't need for a single static heading.
  return (
    <div
      data-slot="dropdown-menu-label"
      className={cn('px-3 py-1.5 text-xs font-medium text-muted-foreground', className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dropdown-menu-separator" className={cn('my-1 h-px bg-border', className)} {...props} />
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
}
