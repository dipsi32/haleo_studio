
// ============= Types for Intake Flow =============

export interface SpaceInfo {
  images: File[];
  roomType: string;
  roomDimensions: string;
  existingElements: string[];
  remodelNote: string;
}

export interface LocationInfo {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: 'house' | 'apartment' | 'condo' | 'townhouse' | '';
}

export interface StylePreferences {
  primaryVibe: string;
  secondaryVibes: string[];
  colorPreferences: string[];
  inspirationLinks: string[];
}

export interface FunctionalRequirements {
  mustHaves: string[];
  niceToHaves: string[];
  restrictions: string[];
  budget: string;
}

export interface IntakeFormData {
  space: SpaceInfo;
  location: LocationInfo;
  style: StylePreferences;
  functional: FunctionalRequirements;
}

export type DesignPhase = 
  | 'welcome'
  | 'intake'
  | 'confirmation'
  | 'inspiration'
  | 'layouts'
  | 'visualization'
  | 'feedback';

export interface ContextualTip {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'permit';
  phase: DesignPhase;
  trigger?: string;
}
