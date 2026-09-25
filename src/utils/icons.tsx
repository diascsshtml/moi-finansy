import type { LucideIcon } from 'lucide-react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Baby,
  Banknote,
  Bus,
  Briefcase,
  Building2,
  Car,
  Clapperboard,
  Cloud,
  Coffee,
  CreditCard,
  Droplet,
  Dumbbell,
  Flame,
  Gamepad2,
  Gift,
  GraduationCap,
  Handshake,
  HelpCircle,
  Home,
  Laptop,
  Landmark,
  Lightbulb,
  Lock,
  Music2,
  Package,
  PawPrint,
  Pill,
  PiggyBank,
  Plane,
  Play,
  Receipt,
  Search,
  Settings as SettingsIcon,
  Shield,
  Shirt,
  Smartphone,
  Star,
  Thermometer,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Trash2,
  Tv,
  UtensilsCrossed,
  User,
  Users,
  Wallet,
  Wrench,
  BarChart3,
  BookOpen,
  ClipboardList,
  Globe,
  Circle,
} from 'lucide-react';

/** Эмодзи, которые пользователь может выбрать для категории/счёта/платежа
 *  (см. ICONS-массивы в *FormSheet.tsx), плюс системные — сопоставлены с
 *  векторными иконками lucide для единого современного вида. Список
 *  выбираемых иконок закрытый (не свободный ввод), так что это отображение
 *  покрывает всё, что реально может оказаться в данных. */
export const EMOJI_ICON_MAP: Record<string, LucideIcon> = {
  '🛒': ShoppingCart,
  '🚌': Bus,
  '🏠': Home,
  '☕': Coffee,
  '💊': Pill,
  '👕': Shirt,
  '🎮': Gamepad2,
  '📱': Smartphone,
  '📚': BookOpen,
  '🎁': Gift,
  '💼': Briefcase,
  '💻': Laptop,
  '📈': TrendingUp,
  '🐾': PawPrint,
  '🚗': Car,
  '✈️': Plane,
  '🍔': UtensilsCrossed,
  '🎬': Clapperboard,
  '💡': Lightbulb,
  '🧾': Receipt,
  '👶': Baby,
  '🏋️': Dumbbell,
  '🎵': Music2,
  '🛠️': Wrench,
  '📦': Package,
  '💳': CreditCard,
  '🏦': Landmark,
  '📺': Tv,
  '🌐': Globe,
  '🎓': GraduationCap,
  '🛡️': Shield,
  '🚰': Droplet,
  '🔥': Flame,
  '♨️': Thermometer,
  '🗑️': Trash2,
  '🏢': Building2,
  '▶️': Play,
  '☁️': Cloud,
  '🟡': Circle,
  '👤': User,
  '💰': PiggyBank,
  '👛': Wallet,
  '👨‍👩‍👧': Users,
  '⭐': Star,
  '🤝': Handshake,
  '🤷': HelpCircle,
  '❓': HelpCircle,
  '🔍': Search,
  '💸': Banknote,
  '📊': BarChart3,
  '🔄': ArrowLeftRight,
  '⚠️': TriangleAlert,
  '🔒': Lock,
  '⚙️': SettingsIcon,
  '📋': ClipboardList,
  '↓': ArrowDown,
  '↑': ArrowUp,
};

interface EmojiIconProps {
  icon: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/** Заменяет эмодзи-иконку (см. EMOJI_ICON_MAP) на векторную — используется
 *  везде, где раньше показывали `category.icon`/`account.icon` и т.п. как
 *  текст. Для не найденного в таблице значения (например, монограмма банка
 *  вроде «Kp» — см. billCatalog.ts, isMonogramIcon) просто возвращает исходный
 *  текст без изменений, чтобы не сломать уже готовый вид. */
export function EmojiIcon({ icon, size = 18, className, strokeWidth = 2 }: EmojiIconProps) {
  const Icon = EMOJI_ICON_MAP[icon];
  if (!Icon) return <>{icon}</>;
  return <Icon size={size} className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
