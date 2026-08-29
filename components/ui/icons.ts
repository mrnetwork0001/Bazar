/**
 * The app's icon vocabulary, backed by Heroicons.
 *
 * Every icon in Bazar comes from https://heroicons.com. This module is the one
 * place the mapping lives: components import semantic names from here, so
 * swapping the underlying set again means editing this file and nothing else.
 *
 * Heroicons ships 324 outline icons against the ~1,500 the app was previously
 * drawing from, so a number of names below are deliberate substitutions rather
 * than exact equivalents. Each one is commented with what it replaced and why,
 * because the nearest-match choices are judgement calls worth auditing:
 * a wrong icon is a small lie about what a control does.
 *
 * All icons are 24x24 outline with a fixed 1.5 stroke. They accept standard SVG
 * props, so existing `className="h-4 w-4"` sizing carries over unchanged.
 */

export {
  /* ---- direct equivalents ---------------------------------------- */
  // Directional arrows (ArrowLeft/Right/UpRight) are deliberately not exported:
  // the app uses no arrow affordances on links or buttons.
  ArrowsUpDownIcon as ArrowUpDown,
  ArrowTrendingUpIcon as TrendingUp,
  ArrowTopRightOnSquareIcon as ExternalLink,
  ArrowDownTrayIcon as Download,
  ArrowUpTrayIcon as Upload,
  ArrowPathIcon as Loader2,
  ArrowUturnLeftIcon as RotateCcw,
  ArrowUturnLeftIcon as Undo2,
  ArrowRightStartOnRectangleIcon as LogOut,
  Bars3Icon as Menu,
  BanknotesIcon as Banknote,
  BeakerIcon as FlaskConical,
  BoltIcon as Zap,
  CalendarDaysIcon as CalendarClock,
  CheckIcon as Check,
  CheckBadgeIcon as BadgeCheck,
  CheckCircleIcon as CheckCircle2,
  CheckCircleIcon as CircleCheck,
  ChevronDownIcon as ChevronDown,
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
  CircleStackIcon as Database,
  ClipboardDocumentIcon as ClipboardCopy,
  ClockIcon as History,
  ClockIcon as Hourglass,
  CodeBracketIcon as Braces,
  CommandLineIcon as Terminal,
  CpuChipIcon as Cpu,
  CursorArrowRaysIcon as MousePointerClick,
  CurrencyDollarIcon as Coins,
  DocumentCheckIcon as FileSignature,
  DocumentDuplicateIcon as Copy,
  DocumentPlusIcon as FilePlus2,
  DocumentTextIcon as FileJson,
  DocumentTextIcon as ScrollText,
  ExclamationTriangleIcon as AlertTriangle,
  ExclamationTriangleIcon as TriangleAlert,
  FingerPrintIcon as Fingerprint,
  HashtagIcon as Hash,
  InboxIcon as Inbox,
  LinkIcon as Link2,
  LockClosedIcon as Lock,
  MagnifyingGlassIcon as Search,
  MagnifyingGlassCircleIcon as ScanSearch,
  MagnifyingGlassMinusIcon as SearchX,
  MinusIcon as Minus,
  PlayIcon as Play,
  PlusCircleIcon as CirclePlus,
  RadioIcon as Radio,
  ReceiptPercentIcon as Receipt,
  RocketLaunchIcon as Rocket,
  ScaleIcon as Scale,
  ShareIcon as Network,
  ShieldCheckIcon as ShieldCheck,
  ShieldExclamationIcon as ShieldOff,
  SignalIcon as Activity,
  SignalSlashIcon as WifiOff,
  SparklesIcon as Sparkles,
  Squares2X2Icon as Grid3x3,
  Squares2X2Icon as LayoutGrid,
  Square2StackIcon as Boxes,
  Square3Stack3DIcon as Layers,
  StarIcon as Star,
  TagIcon as Tag,
  TrophyIcon as Trophy,
  UserIcon as User,
  UserCircleIcon as UserRound,
  WalletIcon as Wallet,
  XMarkIcon as X,
  GlobeAltIcon as Globe,
  EnvelopeIcon as Mail,

  /* ---- substitutions: no Heroicon equivalent exists --------------- */

  /** was Bot - CpuChip is Heroicons' closest "machine agent" mark. */
  CpuChipIcon as Bot,
  /** was ChatBubble for agent messages. */
  ChatBubbleLeftIcon as MessageSquare,
  /** was Gavel (dispute resolution) - a courthouse reads as adjudication,
   *  and Scale is already spoken for by the Rebalancing category. */
  BuildingLibraryIcon as Gavel,
  /** was HeartPulse - the Health Factor category. Heroicons has no pulse line. */
  HeartIcon as HeartPulse,
  /** was Radar (scanning the chain) - a viewfinder is the nearest "sweep". */
  ViewfinderCircleIcon as Radar,
  /** was Plug (MCP servers) - a puzzle piece is the conventional plug-in mark. */
  PuzzlePieceIcon as Plug,
  /** was Webhook (an outbound callback) - Bolt reads as a fired event. */
  BoltIcon as Webhook,
  /** was Vault (escrowed funds) - a closed lock is the honest simplification. */
  LockClosedIcon as Vault,
  /** was Compass (discovery) - Map is the nearest wayfinding mark. */
  MapIcon as Compass,
  /** was HandCoins (payout to an agent). */
  HandRaisedIcon as HandCoins,
  /** was PackageCheck (a delivered job). */
  ArchiveBoxIcon as PackageCheck,
  /** was CircleDashed - a pending, not-yet-started step. */
  EllipsisHorizontalCircleIcon as CircleDashed,
  /** was CircleDot - the current step in a sequence. */
  StopCircleIcon as CircleDot,
} from '@heroicons/react/24/outline';

/**
 * Shape of every icon in this module. Heroicons components are forwardRef SVG
 * components, so this is what to use where a component was typed `LucideIcon`.
 */
export type AppIcon = React.ForwardRefExoticComponent<
  Omit<React.SVGProps<SVGSVGElement>, 'ref'> & {
    title?: string;
    titleId?: string;
  } & React.RefAttributes<SVGSVGElement>
>;
