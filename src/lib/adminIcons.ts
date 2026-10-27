// Feather icons for the admin shell, typed as ordinary React components.
// react-icons' own icon type returns ReactNode, which CRA's TypeScript rejects as
// JSX; the repo casts them to ComponentType<IconBaseProps> (see uvsa/icons.ts).
import type { ComponentType } from 'react';
import type { IconBaseProps } from 'react-icons';
import * as feather from 'react-icons/fi';

export type AdminIcon = ComponentType<IconBaseProps>;

const asIcon = (icon: unknown): AdminIcon => icon as AdminIcon;

export const FiActivity = asIcon(feather.FiActivity);
export const FiAlertTriangle = asIcon(feather.FiAlertTriangle);
export const FiArrowLeft = asIcon(feather.FiArrowLeft);
export const FiAward = asIcon(feather.FiAward);
export const FiBarChart2 = asIcon(feather.FiBarChart2);
export const FiBriefcase = asIcon(feather.FiBriefcase);
export const FiCalendar = asIcon(feather.FiCalendar);
export const FiCamera = asIcon(feather.FiCamera);
export const FiCheckCircle = asIcon(feather.FiCheckCircle);
export const FiCheckSquare = asIcon(feather.FiCheckSquare);
export const FiChevronDown = asIcon(feather.FiChevronDown);
export const FiClock = asIcon(feather.FiClock);
export const FiEdit3 = asIcon(feather.FiEdit3);
export const FiExternalLink = asIcon(feather.FiExternalLink);
export const FiFileText = asIcon(feather.FiFileText);
export const FiFilm = asIcon(feather.FiFilm);
export const FiFolder = asIcon(feather.FiFolder);
export const FiGitMerge = asIcon(feather.FiGitMerge);
export const FiGrid = asIcon(feather.FiGrid);
export const FiHeart = asIcon(feather.FiHeart);
export const FiHome = asIcon(feather.FiHome);
export const FiImage = asIcon(feather.FiImage);
export const FiList = asIcon(feather.FiList);
export const FiLoader = asIcon(feather.FiLoader);
export const FiMapPin = asIcon(feather.FiMapPin);
export const FiMenu = asIcon(feather.FiMenu);
export const FiMessageCircle = asIcon(feather.FiMessageCircle);
export const FiMessageSquare = asIcon(feather.FiMessageSquare);
export const FiPlayCircle = asIcon(feather.FiPlayCircle);
export const FiRefreshCw = asIcon(feather.FiRefreshCw);
export const FiRepeat = asIcon(feather.FiRepeat);
export const FiRotateCcw = asIcon(feather.FiRotateCcw);
export const FiSearch = asIcon(feather.FiSearch);
export const FiSettings = asIcon(feather.FiSettings);
export const FiShield = asIcon(feather.FiShield);
export const FiStar = asIcon(feather.FiStar);
export const FiThumbsUp = asIcon(feather.FiThumbsUp);
export const FiUpload = asIcon(feather.FiUpload);
export const FiUserCheck = asIcon(feather.FiUserCheck);
export const FiUsers = asIcon(feather.FiUsers);
export const FiX = asIcon(feather.FiX);
export const FiXCircle = asIcon(feather.FiXCircle);
