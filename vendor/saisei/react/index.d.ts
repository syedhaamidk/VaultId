import * as React from "react";

export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Tone = "accent" | "warning" | "danger" | "";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm";
}
export declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tag?: string;
  title?: string;
  corners?: boolean;
  enter?: boolean;
}
export declare const Card: React.FC<CardProps>;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}
export declare const Badge: React.FC<BadgeProps>;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "accent" | "warning" | "danger";
  tag?: string;
}
export declare const Alert: React.FC<AlertProps>;

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}
export declare const Skeleton: React.FC<SkeletonProps>;

export interface EmptyProps {
  tag?: string;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}
export declare const Empty: React.FC<EmptyProps>;

export interface ProgressProps {
  value: number;
  label?: string;
  id?: string;
}
export declare const Progress: React.FC<ProgressProps>;

export interface Crumb {
  label: string;
  href?: string;
}
export declare const Crumbs: React.FC<{ trail: Crumb[]; label?: string }>;

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  labelledBy?: string;
  describedBy?: string;
  tag?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "lg";
}
export declare const Modal: React.FC<ModalProps>;

export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}
export interface TabsProps {
  tabs: Tab[];
  activeId?: string;
  defaultId?: string;
  onChange?: (id: string) => void;
  label?: string;
}
export declare const Tabs: React.FC<TabsProps>;

export interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
}
export declare const Accordion: React.FC<{
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpen?: string[];
}>;

export declare const ToastProvider: React.FC<{ children?: React.ReactNode }>;
export interface ToastAction {
  label: string;
  run?: () => void;
}
export declare function useToast(): (message: string, action?: ToastAction) => void;

export interface TapeItem {
  symbol: string;
  price: string;
  change: string;
  up?: boolean;
}
export declare const TickerTape: React.FC<{ items: TapeItem[]; label?: string }>;

export declare const ThemeToggle: React.FC<{ className?: string }>;

export interface Column {
  key: string;
  label: string;
  render?: (value: unknown, row: Row) => React.ReactNode;
}
export type Row = Record<string, unknown> & { id?: string | number };
export declare const DataTable: React.FC<{
  columns: Column[];
  rows: Row[];
  pageSize?: number;
  filterPlaceholder?: string;
  labelledBy?: string;
}>;

export interface Command {
  label: string;
  hint?: string;
  run: () => void;
}
export declare const CommandPalette: React.FC<{
  items: Command[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: string;
}>;

export interface DropdownItem {
  label: string;
  hint?: string;
  sep?: boolean;
  onSelect?: () => void;
}
export declare const Dropdown: React.FC<{
  label: string;
  items: DropdownItem[];
  align?: "left" | "right";
}>;

export declare const Combobox: React.FC<{
  label: string;
  options: Array<string | { value: string; label: string }>;
  placeholder?: string;
  onPick?: (value: string) => void;
}>;

export declare const Reveal: React.FC<{
  as?: keyof React.JSX.IntrinsicElements;
  delay?: number;
  className?: string;
  children?: React.ReactNode;
}>;

export declare const Drawer: React.FC<{
  open: boolean;
  onClose?: () => void;
  labelledBy?: string;
  label?: string;
  children?: React.ReactNode;
}>;

export declare const AnimatedNumber: React.FC<{
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}>;

export declare const TiltCard: React.FC<{
  children?: React.ReactNode;
  max?: number;
  glare?: boolean;
  spotlight?: boolean;
  className?: string;
}>;

export declare const DrawOn: React.FC<{
  children?: React.ReactNode;
  played?: boolean;
  width?: string | number;
  height?: string | number;
  label?: string;
}>;

export declare const ScrollRule: React.FC;
