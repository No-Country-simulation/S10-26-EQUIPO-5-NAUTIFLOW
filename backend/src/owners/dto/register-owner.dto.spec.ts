import { validate } from 'class-validator';
import { RegisterOwnerDto } from './register-owner.dto.js';

describe('RegisterOwnerDto email', () => {
  const validRegistration = (email: string): RegisterOwnerDto =>
    Object.assign(new RegisterOwnerDto(), {
      fullName: 'Boat Owner',
      email,
      password: 'a-long-secure-password',
      phone: '123456789',
    });

  it.each(['owner@gmail.com', 'owner@hotmail.com', 'owner@outlook.com'])(
    'accepts %s',
    async (email) => {
      expect(await validate(validRegistration(email))).toHaveLength(0);
    },
  );

  it.each(['owner@example.com', 'not-an-email'])(
    'rejects %s',
    async (email) => {
      const errors = await validate(validRegistration(email));
      expect(errors.some(({ property }) => property === 'email')).toBe(true);
    },
  );
});
