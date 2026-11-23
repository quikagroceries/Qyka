"use client";

import { TextField, SelectField } from "@/components/rider/FormField";
import UploadField from "@/components/rider/UploadField";
import {
  OWNERSHIP_STATUSES,
  VEHICLE_TYPES,
  type RiderApplicationData,
} from "@/components/rider/riderFormTypes";

// Section D — Vehicle Specifications & Roadworthiness.
function StepVehicle({
  data,
  update,
  errors,
}: {
  data: RiderApplicationData;
  update: (patch: Partial<RiderApplicationData>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-5">
      <SelectField
        id="vehicleType" label="Vehicle type" required options={VEHICLE_TYPES}
        value={data.vehicleType} onChange={(e: any) => update({ vehicleType: e.target.value })} error={errors.vehicleType}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="vehicleMake" label="Make" required value={data.vehicleMake} onChange={(e: any) => update({ vehicleMake: e.target.value })} error={errors.vehicleMake} />
        <TextField id="vehicleModel" label="Model" required value={data.vehicleModel} onChange={(e: any) => update({ vehicleModel: e.target.value })} error={errors.vehicleModel} />
        <TextField id="vehicleYear" label="Year of manufacture" required inputMode="numeric" value={data.vehicleYear} onChange={(e: any) => update({ vehicleYear: e.target.value })} error={errors.vehicleYear} />
        <TextField id="vehicleColor" label="Color" required value={data.vehicleColor} onChange={(e: any) => update({ vehicleColor: e.target.value })} error={errors.vehicleColor} />
      </div>
      <TextField
        id="vehiclePlate" label="License plate number" required
        value={data.vehiclePlate} onChange={(e: any) => update({ vehiclePlate: e.target.value.toUpperCase() })} error={errors.vehiclePlate}
      />

      <SelectField
        id="ownershipStatus" label="Vehicle ownership status" required options={OWNERSHIP_STATUSES}
        value={data.ownershipStatus} onChange={(e: any) => update({ ownershipStatus: e.target.value })} error={errors.ownershipStatus}
      />
      {data.ownershipStatus === "rented" && (
        <UploadField
          id="leaseAgreementFile" label="Notarized lease / rental agreement" required accept="image/*,.pdf"
          value={data.leaseAgreementFile} onChange={(f) => update({ leaseAgreementFile: f })} error={errors.leaseAgreementFile}
        />
      )}

      <div className="border-t border-dashed border-line pt-5">
        <p className="mb-3 font-display text-base font-extrabold text-ink">Mandatory documentation</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <UploadField id="registrationFile" label="Proof of ownership / registration" required accept="image/*,.pdf" value={data.registrationFile} onChange={(f) => update({ registrationFile: f })} error={errors.registrationFile} />
          <UploadField id="insuranceFile" label="Commercial third-party insurance certificate" required accept="image/*,.pdf" value={data.insuranceFile} onChange={(f) => update({ insuranceFile: f })} error={errors.insuranceFile} />
          <UploadField id="roadworthinessFile" label="Valid roadworthiness certificate" required accept="image/*,.pdf" value={data.roadworthinessFile} onChange={(f) => update({ roadworthinessFile: f })} error={errors.roadworthinessFile} />
        </div>
      </div>

      <div className="border-t border-dashed border-line pt-5">
        <p className="mb-3 font-display text-base font-extrabold text-ink">Visual inspection</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <UploadField id="photoFront" label="Vehicle — front" required value={data.photoFront} onChange={(f) => update({ photoFront: f })} error={errors.photoFront} />
          <UploadField id="photoBack" label="Vehicle — back" required value={data.photoBack} onChange={(f) => update({ photoBack: f })} error={errors.photoBack} />
          <UploadField id="photoLeft" label="Vehicle — left side" required value={data.photoLeft} onChange={(f) => update({ photoLeft: f })} error={errors.photoLeft} />
          <UploadField id="photoRight" label="Vehicle — right side" required value={data.photoRight} onChange={(f) => update({ photoRight: f })} error={errors.photoRight} />
          <UploadField id="photoEngineNumber" label="Engine / chassis number stamping" required hint="Close-up of the stamped number." value={data.photoEngineNumber} onChange={(f) => update({ photoEngineNumber: f })} error={errors.photoEngineNumber} />
          <UploadField id="photoStorageBox" label="Delivery storage box / insulated bag" required hint="Crucial for keeping fresh market produce at temperature." value={data.photoStorageBox} onChange={(f) => update({ photoStorageBox: f })} error={errors.photoStorageBox} />
        </div>
      </div>
    </div>
  );
}

export default StepVehicle;
