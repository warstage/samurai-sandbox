// Copyright Felix Ungman. All rights reserved.
// Licensed under GNU General Public License version 3 or later.

export enum SamuraiPlatform {
    Cavalry = 0,
    General = 1,
    Ashigaru = 2,
    Samurai = 3
}

export enum SamuraiWeapon {
    Yari = 0,
    Katana = 1,
    Naginata = 2,
    Bow = 3,
    Arq = 4,
    Cannon = 5
}

export function getSamuraiPlatform(unitClass: string): SamuraiPlatform {
    if (unitClass.startsWith('CAV')) {
        return SamuraiPlatform.Cavalry;
    }
    if (unitClass.startsWith('GEN')) {
        return SamuraiPlatform.General;
    }
    if (unitClass.startsWith('ASH')) {
        return SamuraiPlatform.Ashigaru;
    }
    if (unitClass.startsWith('SAM')) {
        return SamuraiPlatform.Samurai;
    }
    return SamuraiPlatform.Cavalry;
}

export function getSamuraiWeapon(unitClass: string): SamuraiWeapon {
    if (unitClass.endsWith('YARI')) {
        return SamuraiWeapon.Yari;
    }
    if (unitClass.endsWith('KATA')) {
        return SamuraiWeapon.Katana;
    }
    if (unitClass.endsWith('NAGI')) {
        return SamuraiWeapon.Naginata;
    }
    if (unitClass.endsWith('BOW')) {
        return SamuraiWeapon.Bow;
    }
    if (unitClass.endsWith('ARQ')) {
        return SamuraiWeapon.Arq;
    }
    if (unitClass.endsWith('CAN')) {
        return SamuraiWeapon.Cannon;
    }
    return SamuraiWeapon.Arq;
}

export function getUnitClass(platform: SamuraiPlatform , weapon: SamuraiWeapon) {
    let result = '';
    switch (platform) {
        case SamuraiPlatform.Cavalry: result += 'CAV'; break;
        case SamuraiPlatform.General: result += 'GEN'; break;
        case SamuraiPlatform.Ashigaru: result += 'ASH'; break;
        case SamuraiPlatform.Samurai: result += 'SAM'; break;
    }
    switch (weapon) {
        case SamuraiWeapon.Yari: result += '-YARI'; break;
        case SamuraiWeapon.Katana: result += '-KATA'; break;
        case SamuraiWeapon.Naginata: result += '-NAGI'; break;
        case SamuraiWeapon.Bow: result += '-BOW'; break;
        case SamuraiWeapon.Arq: result += '-ARQ'; break;
        case SamuraiWeapon.Cannon: result += '-CAN'; break;
    }
    return result;
}

export function getDefaultUnitSize(platform: SamuraiPlatform , weapon: SamuraiWeapon) {
    if (weapon === SamuraiWeapon.Cannon) {
        return 12;
    }
    switch (platform) {
        case SamuraiPlatform.Cavalry:
        case SamuraiPlatform.General:
            return 40;
        case SamuraiPlatform.Ashigaru:
        case SamuraiPlatform.Samurai:
            return 80;
    }
    return 0;
}

