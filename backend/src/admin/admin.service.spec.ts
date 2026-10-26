import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Boat, VerificationStatus } from '../boats/boat.entity.js';
import { BoatsService } from '../boats/boats.service.js';
import { Owner } from '../owners/owner.entity.js';
import { AdminService } from './admin.service.js';

describe('AdminService boat verification', () => {
  const findOneBy = vi.fn();
  const save = vi.fn((boat) => Promise.resolve(boat));
  const boatsRepository = { findOneBy, save };
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
      verificationStatus: 'pending',
      verificationReason: null,
      verifiedBy: null,
      verifiedAt: null,
    } as unknown as Boat;
    findOneBy.mockResolvedValue(boat);

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
    findOneBy.mockResolvedValue({
      id: 'boat-id',
    } as Boat);

    await expect(
      service.verifyBoat('boat-id', 'admin-id', {
        status: VerificationStatus.REJECTED,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('returns not found for an unknown boat', async () => {
    findOneBy.mockResolvedValue(null);

    await expect(
      service.verifyBoat('missing-id', 'admin-id', {
        status: VerificationStatus.APPROVED,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
