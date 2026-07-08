import React from 'react'
import { type VariantProps } from 'class-variance-authority'
import { iconVariants } from './icon-variants'
import ArrowIcon from './arrow-icon'
import AvatarIcon from './avatar-icon'
import BadgeIcon from './badge-icon'
import CalculatorIcon from './calculator-icon'
import Calendar from './calendar'
import CheckIcon from './check-icon'
import CloseIcon from './close-icon'
import CommentIcon from './comment-icon'
import CommunityIcon from './community-icon'
import ContrastIcon from './contrast-icon'
import DownloadIcon from './download-icon'
import DropdownIcon from './dropdown-icon'
import EcoIcon from './eco-icon'
import EnvelopeIcon from './envelope-icon'
import FileZipperIcon from './file-zipper-icon'
import FullscreenIcon from './fullscreen-icon'
import GearsIcon from './gears-icon'
import HandsIcon from './hands-icon'
import HomeIcon from './home-icon'
import IdCardIcon from './id-card-icon'
import LawIcon from './law-icon'
import LocationIcon from './location-icon'
import MegaphoneIcon from './megaphone-icon'
import MenuDotsIcon from './menu-dots-icon'
import MicrophoneIcon from './microphone-icon'
import MinusIcon from './minus-icon'
import MoneyIcon from './money-icon'
import MuteIcon from './mute-icon'
import NotificationIcon from './notification-icon'
import NotificationPositiveIcon from './notification-positive-icon'
import OrganizationIcon from './organization-icon'
import PauseIcon from './pause-icon'
import PlayIcon from './play-icon'
import PlusIcon from './plus-icon'
import SettingsSlidersIcon from './settings-sliders-icon'
import ShareIcon from './share-icon'
import SignOutIcon from './sign-out-icon'
import StageIcon from './stage-icon'
import StopIcon from './stop-icon'
import StrategyIcon from './strategy-icon'
import SurveyIcon from './survey-icon'
import TagsIcon from './tags-icon'
import ThirdPartyIcon from './third-party-icon'
import UserIcon from './user-icon'
import VideoIcon from './video-icon'
import VolumeIcon from './volume-icon'
import WriteIcon from './write-icon'
import { cn } from '@/lib/utils/cn'

type PropsT = VariantProps<typeof iconVariants> & {
  wrapperClassName?: string
  className?: string
  iconName:
    | 'calendar'
    | 'calendarAdd'
    | 'calendarApproved'
    | 'calendarProcessing'
    | 'calendarRevoked'
    | 'arrowDown'
    | 'arrowUp'
    | 'arrowLeft'
    | 'arrowRight'
    | 'check'
    | 'close'
    | 'dropdownDown'
    | 'dropdownUp'
    | 'minus'
    | 'plus'
    | 'play'
    | 'pause'
    | 'stop'
    | 'video'
    | 'microphone'
    | 'volume'
    | 'mute'
    | 'notification'
    | 'notificationPositive'
    | 'envelope'
    | 'user'
    | 'home'
    | 'download'
    | 'share'
    | 'comment'
    | 'write'
    | 'location'
    | 'badge'
    | 'fullscreen'
    | 'menuDots'
    | 'contrast'
    | 'avatar'
    | 'fileZipper'
    | 'idCard'
    | 'calculator'
    | 'money'
    | 'tags'
    | 'law'
    | 'community'
    | 'organization'
    | 'hands'
    | 'megaphone'
    | 'strategy'
    | 'survey'
    | 'stage'
    | 'eco'
    | 'thirdParty'
    | 'settingsSliders'
    | 'gears'
    | 'signOut'
}

const iconRegistry = {
  calendar: Calendar,
  calendarAdd: Calendar,
  calendarApproved: Calendar,
  calendarProcessing: Calendar,
  calendarRevoked: Calendar,
  arrowDown: ArrowIcon,
  arrowUp: ArrowIcon,
  arrowLeft: ArrowIcon,
  arrowRight: ArrowIcon,
  check: CheckIcon,
  close: CloseIcon,
  dropdownDown: DropdownIcon,
  dropdownUp: DropdownIcon,
  minus: MinusIcon,
  plus: PlusIcon,
  play: PlayIcon,
  pause: PauseIcon,
  stop: StopIcon,
  video: VideoIcon,
  microphone: MicrophoneIcon,
  volume: VolumeIcon,
  mute: MuteIcon,
  notification: NotificationIcon,
  notificationPositive: NotificationPositiveIcon,
  envelope: EnvelopeIcon,
  user: UserIcon,
  home: HomeIcon,
  download: DownloadIcon,
  share: ShareIcon,
  comment: CommentIcon,
  write: WriteIcon,
  location: LocationIcon,
  badge: BadgeIcon,
  fullscreen: FullscreenIcon,
  menuDots: MenuDotsIcon,
  contrast: ContrastIcon,
  avatar: AvatarIcon,
  fileZipper: FileZipperIcon,
  idCard: IdCardIcon,
  calculator: CalculatorIcon,
  money: MoneyIcon,
  tags: TagsIcon,
  law: LawIcon,
  community: CommunityIcon,
  organization: OrganizationIcon,
  hands: HandsIcon,
  megaphone: MegaphoneIcon,
  strategy: StrategyIcon,
  survey: SurveyIcon,
  stage: StageIcon,
  eco: EcoIcon,
  thirdParty: ThirdPartyIcon,
  settingsSliders: SettingsSlidersIcon,
  gears: GearsIcon,
  signOut: SignOutIcon,
}

const additionalProps: Record<string, object> = {
  calendarAdd: { type: 'add' },
  calendarApproved: { type: 'approved' },
  calendarProcessing: { type: 'processing' },
  calendarRevoked: { type: 'revoked' },
  calendar: { type: 'default' },
  arrowUp: { direction: 'up' },
  arrowDown: { direction: 'down' },
  arrowLeft: { direction: 'left' },
  arrowRight: { direction: 'right' },
  dropdownUp: { direction: 'up' },
  dropdownDown: { direction: 'down' },
}

export default function Icon({ size, className, iconName, wrapperClassName }: PropsT) {
  const SelectedIcon = iconRegistry[iconName] as React.ComponentType<PropsT>
  const extraProps = additionalProps[iconName] ?? {}

  return (
    <div className={cn('flex size-4 items-center justify-center', wrapperClassName)}>
      <SelectedIcon size={size} className={className} iconName={iconName} {...extraProps} />
    </div>
  )
}
