import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Boat, VerificationStatus } from '../boats/boat.entity.js';
import { BoatsService } from '../boats/boats.service.js';
import { Owner } from '../owners/owner.entity.js';
import { AdminService } from './admin.service.js';

describe('AdminService boat verification', () => {
  const findOne = vi.fn();
  const save = vi.fn((boat) => Promise.resolve(boat));
  const boatsRepository = { findOne, save };
  const ownersRepository = {};
  const boatsService = { create: vi.fn() };

  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService(
      ownersRepository as unknown as Repository<Owner>,
      boatsRepository as unknown as Repository<Boat>,
      boatsService as unknown as BoatsService,
    );
  });

  it('records the decision, reason, administrator, and timestamp', async () => {
    const boat = {
      id: 'boat-id',
      passengerCapacity: 8,
      availablePassengerCapacity: 8,
      documents: [{ type: 'license' }],
      verificationStatus: VerificationStatus.PENDING,
      verificationReason: null,
      verifiedBy: null,
      verifiedAt: null,
    } as unknown as Boat;
    findOne.mockResolvedValue(boat);

    const result = await service.verifyBoat('boat-id', 'admin-id', {
      status: VerificationStatus.REJECTED,
      reason: ' Documentación vencida ',
    });

    expect(result.verificationStatus).toBe(VerificationStatus.REJECTED);
    expect(result.verificationReason).toBe('Documentación vencida');
    expect(result.verifiedBy).toBe('admin-id');
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalledWith(boat);
  });

  it('requires a reason when rejecting a boat', async () => {
    findOne.mockResolvedValue({
      id: 'boat-id',
      verificationStatus: VerificationStatus.PENDING,
    } as Boat);

    await expect(
      service.verifyBoat('boat-id', 'admin-id', {
        status: VerificationStatus.REJECTED,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('returns not found for an unknown boat', async () => {
    findOne.mockResolvedValue(null);

    await expect(
      service.verifyBoat('missing-id', 'admin-id', {
        status: VerificationStatus.APPROVED,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('uses the license capacity when approving a boat', async () => {
    const boat = {
      id: 'boat-id',
      passengerCapacity: 8,
      availablePassengerCapacity: 8,
      documents: [{ type: 'license' }],
      verificationStatus: VerificationStatus.PENDING,
    } as unknown as Boat;
    findOne.mockResolvedValue(boat);

    const result = await service.verifyBoat('boat-id', 'admin-id', {
      status: VerificationStatus.APPROVED,
      documentedPassengerCapacity: 7,
    });

    expect(result.passengerCapacity).toBe(7);
    expect(result.availablePassengerCapacity).toBe(7);
    expect(result.documentedPassengerCapacity).toBe(7);
    expect(result.verificationStatus).toBe(VerificationStatus.APPROVED);
    expect(save).toHaveBeenCalledWith(boat);
  });

  it('requires a reviewed license before approving a boat', async () => {
    findOne.mockResolvedValue({
      id: 'boat-id',
      passengerCapacity: 8,
      documents: [],
      verificationStatus: VerificationStatus.PENDING,
    } as unknown as Boat);

    await expect(
      service.verifyBoat('boat-id', 'admin-id', {
        status: VerificationStatus.APPROVED,
        documentedPassengerCapacity: 8,
      }),
    ).rejects.toThrow('licencia');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not allow changing a boat after its verification decision', async () => {
    findOne.mockResolvedValue({
      id: 'boat-id',
      verificationStatus: VerificationStatus.APPROVED,
    } as Boat);

    await expect(
      service.verifyBoat('boat-id', 'admin-id', {
        status: VerificationStatus.APPROVED,
        documentedPassengerCapacity: 8,
      }),
    ).rejects.toThrow('ya fue revisada');
    expect(save).not.toHaveBeenCalled();
  });
});
