import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

const challengePattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export class MfaLoginDto {
  @IsString()
  @Matches(challengePattern)
  challenge!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class MfaRecoveryDto {
  @IsString()
  @Matches(challengePattern)
  challenge!: string;

  @IsString()
  @Length(8, 128)
  code!: string;
}
