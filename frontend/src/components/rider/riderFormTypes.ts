// Shape of the full rider-onboarding application (brief: Sections A-E).
// Kept as plain strings/File|null, hand-rolled validation — matches the
// rest of the codebase's forms (no react-hook-form/zod here).

export type IdDocType = "nin_slip" | "nin_card" | "passport" | "pvc";
export type LicenseClass = "class_a" | "class_e";
export type VehicleType = "bicycle" | "motorcycle" | "car" | "van";
export type OwnershipStatus = "owned" | "leased" | "rented";

export type GuarantorInfo = {
  fullName: string;
  relationship: string; // "Civil Servant" | "Religious Leader" | "Corporate Employer"
  phone: string;
  address: string;
  idFile: File | null;
  photoFile: File | null;
};

export type RiderApplicationData = {
  // Section A — Personal Identity & Legal Verification
  fullName: string;
  phone: string;
  dob: string; // yyyy-mm-dd
  address: string;
  geoLat: string;
  geoLng: string;
  idDocType: IdDocType | "";
  idDocNumber: string;
  idDocExpiry: string;
  idDocFile: File | null;
  selfieFile: File | null;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  emergencyAddress: string;

  // Section B — Guarantor & Background Vetting
  guarantor1: GuarantorInfo;
  guarantor2: GuarantorInfo;
  hasCriminalConviction: "yes" | "no" | "";
  consentsToBackgroundCheck: boolean;

  // Section C — Driver's License & Regulatory Compliance
  licenseClass: LicenseClass | "";
  licenseNumber: string;
  licenseExpiry: string;
  licenseFrontFile: File | null;
  licenseBackFile: File | null;
  licenseVerified: boolean;

  // Section D — Vehicle Specifications & Roadworthiness
  vehicleType: VehicleType | "";
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  vehiclePlate: string;
  ownershipStatus: OwnershipStatus | "";
  leaseAgreementFile: File | null;
  registrationFile: File | null;
  insuranceFile: File | null;
  roadworthinessFile: File | null;
  photoFront: File | null;
  photoBack: File | null;
  photoLeft: File | null;
  photoRight: File | null;
  photoEngineNumber: File | null;
  photoStorageBox: File | null;

  // Section E — Banking, Payout & Financial Security
  accountName: string;
  bankName: string;
  accountNumber: string;
  acceptsDepositAuthorization: boolean;
};

const emptyGuarantor: GuarantorInfo = {
  fullName: "",
  relationship: "",
  phone: "",
  address: "",
  idFile: null,
  photoFile: null,
};

export const EMPTY_RIDER_APPLICATION: RiderApplicationData = {
  fullName: "",
  phone: "+234",
  dob: "",
  address: "",
  geoLat: "",
  geoLng: "",
  idDocType: "",
  idDocNumber: "",
  idDocExpiry: "",
  idDocFile: null,
  selfieFile: null,
  emergencyName: "",
  emergencyRelationship: "",
  emergencyPhone: "",
  emergencyAddress: "",

  guarantor1: { ...emptyGuarantor },
  guarantor2: { ...emptyGuarantor },
  hasCriminalConviction: "",
  consentsToBackgroundCheck: false,

  licenseClass: "",
  licenseNumber: "",
  licenseExpiry: "",
  licenseFrontFile: null,
  licenseBackFile: null,
  licenseVerified: false,

  vehicleType: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleYear: "",
  vehicleColor: "",
  vehiclePlate: "",
  ownershipStatus: "",
  leaseAgreementFile: null,
  registrationFile: null,
  insuranceFile: null,
  roadworthinessFile: null,
  photoFront: null,
  photoBack: null,
  photoLeft: null,
  photoRight: null,
  photoEngineNumber: null,
  photoStorageBox: null,

  accountName: "",
  bankName: "",
  accountNumber: "",
  acceptsDepositAuthorization: false,
};

export const RIDER_STEPS = [
  { key: "identity", label: "Identity" },
  { key: "guarantors", label: "Guarantors" },
  { key: "license", label: "License" },
  { key: "vehicle", label: "Vehicle" },
  { key: "banking", label: "Banking" },
] as const;

export type RiderStepKey = (typeof RIDER_STEPS)[number]["key"];

export const ID_DOC_TYPES: { value: IdDocType; label: string }[] = [
  { value: "nin_slip", label: "National ID (NIN Slip)" },
  { value: "nin_card", label: "National ID (NIN Card)" },
  { value: "passport", label: "International Passport" },
  { value: "pvc", label: "Permanent Voter's Card (PVC)" },
];

export const GUARANTOR_RELATIONSHIPS = ["Civil Servant", "Religious Leader", "Corporate Employer"];

export const LICENSE_CLASSES: { value: LicenseClass; label: string }[] = [
  { value: "class_a", label: "Class A — Motorcycle" },
  { value: "class_e", label: "Class E — Commercial Vehicle / Car" },
];

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: "bicycle", label: "Bicycle / E-Bike" },
  { value: "motorcycle", label: "Commercial Motorcycle (Okada / Dispatch Bike)" },
  { value: "car", label: "Sedan / Hatchback (Car Delivery)" },
  { value: "van", label: "Mini-Van / Bus (Bulk Market Dispatch)" },
];

export const OWNERSHIP_STATUSES: { value: OwnershipStatus; label: string }[] = [
  { value: "owned", label: "Owned" },
  { value: "leased", label: "Company-Leased" },
  { value: "rented", label: "Rented" },
];

export const NIGERIAN_BANKS = [
  "Access Bank", "Citibank Nigeria", "Ecobank Nigeria", "Fidelity Bank", "First Bank of Nigeria",
  "First City Monument Bank", "Globus Bank", "Guaranty Trust Bank", "Keystone Bank", "Kuda Bank",
  "Moniepoint MFB", "Opay", "Palmpay", "Polaris Bank", "Providus Bank", "Stanbic IBTC Bank",
  "Standard Chartered Bank", "Sterling Bank", "SunTrust Bank", "Union Bank of Nigeria",
  "United Bank for Africa", "Unity Bank", "Wema Bank", "Zenith Bank",
];
