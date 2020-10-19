// Copyright Felix Ungman. All rights reserved.
// Licensed under GNU General Public License version 3 or later.

import {
    Alliance,
    Commander,
    DeploymentUnit,
    Federation,
    getDefaultUnitSize,
    getDefaultUnitStats,
    getUnitClass,
    Match,
    ObjectRef,
    RuntimeConfiguration,
    SamuraiPlatform,
    SamuraiWeapon,
    Scenario,
    ScenarioRunner,
    Slot,
    Team,
    Unit,
    Value,
    vec2
} from 'warstage-runtime';
import {Subscription} from 'rxjs';

RuntimeConfiguration.autoRedirect();

export class SandboxScenario implements Scenario {
    private subscription: Subscription;
    private match: Match;
    private arenaFederation: Federation;
    private battleFederation: Federation;

    constructor(private playerId: string) {
    }
    getParams(): Value {
        return {
            teams: [
                {slots: [{playerId: this.playerId}]},
                {slots: [{playerId: this.playerId}]}
            ],
            teamsMin: 2,
            teamsMax: 99,
            title: 'sandbox',
            map: 'Maps/Map1.png',
            options: {
                map: true,
                teams: true,
                sandbox: true
            },
            settings: {
                sandbox: true
            },
            started: false
        };
    }

    startup(match: ObjectRef, arenaFederation: Federation, battleFederation: Federation) {
        this.match = match as Match;
        this.arenaFederation = arenaFederation;
        this.battleFederation = battleFederation;

        this.createAlliances().then(() => {}, err => console.error(err));

        this.subscription = this.arenaFederation.objects<Match>('Match').subscribe(() => {
            this.recreateAlliances().then(() => {}, err => console.error(err));
        });

        this.subscription.add(this.arenaFederation.objects<Team>('Team').subscribe(() => {
            this.recreateAlliances().then(() => {}, err => console.error(err));
        }));

        this.subscription.add(this.arenaFederation.objects<Slot>('Slot').subscribe(() => {
            this.recreateAlliances().then(() => {}, err => console.error(err));
        }));

        this.subscription.add(this.battleFederation.objects<Unit>('Unit').subscribe(unit => {
            if ((unit.fighters$changed && !unit.fighters) || unit.deletedByGesture) {
                unit.$delete();
            }
        }));

        this.battleFederation.observeEvents('DeployUnit', (params: {
            deploymentUnit: DeploymentUnit;
            position: vec2;
            deleted: boolean;
        }) => {
            if (!params.deleted) {
                this.deployUnit(params.deploymentUnit, params.position);
            }
        });
    }

    shutdown() {
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
    }

    deployUnit(deploymentUnit: DeploymentUnit, position: vec2) {
        const platform = deploymentUnit.platform as unknown as SamuraiPlatform;
        const weapon = deploymentUnit.weapon as unknown as SamuraiWeapon;
        const delta = {x: 512 - position.x, y: 512 - position.y};
        const facing = Math.atan2(delta.y, delta.x);

        const alliance = deploymentUnit.alliance;
        let commander = deploymentUnit.commander;
        if (!commander) {
            commander = this.battleFederation.objects<Commander>('Commander').find(x => x.alliance === alliance);
        }

        console.log('deployUnit, commander=' + (commander ? commander.playerId : 'null'));

        const unitClass = getUnitClass(platform, weapon);
        const unitStats = getDefaultUnitStats(unitClass);
        let fighterCount = getDefaultUnitSize(platform, weapon) as number;

        this.battleFederation.objects<Unit>('Unit').create({
            alliance,
            commander,
            'stats.unitClass': unitClass,
            'stats.unitStats': unitStats,
            'stats.fighterCount': fighterCount,
            'stats.placement': {x: position.x, y: position.y, z: facing},
            deletable: true
        });
    }

    async recreateAlliances() {
        await this.removeAlliances();
        await this.createAlliances();
    }

    async removeAlliances() {
        for (const object of this.battleFederation.objects<Alliance>('Alliance')) {
            object.$delete();
        }
        for (const object of this.battleFederation.objects<Commander>('Commander')) {
            object.$delete();
        }
        for (const object of this.battleFederation.objects<DeploymentUnit>('DeploymentUnit')) {
            object.$delete();
        }
    }

    async createAlliances() {
        let position = 0;
        for (const team of this.match.teams) {
            const alliance = this.battleFederation.objects<Alliance>('Alliance').create({
                position: ++position
            });
            this.createReinforcements(alliance, position);

            for (const slot of team.slots) {
                if (slot.playerId) {
                    const commander = this.battleFederation.objects<Commander>('Commander').create({
                        alliance,
                        playerId: slot.playerId
                    });
                }
            }
        }
    }

    createReinforcements(alliance: Alliance, position: number) {
        this.createReinforcement(alliance, position, 0, 0, 5, SamuraiPlatform.Ashigaru, SamuraiWeapon.Arq);
        this.createReinforcement(alliance, position, 0, 1, 5, SamuraiPlatform.Samurai, SamuraiWeapon.Arq);
        this.createReinforcement(alliance, position, 0, 2, 5, SamuraiPlatform.Ashigaru, SamuraiWeapon.Bow);
        this.createReinforcement(alliance, position, 0, 3, 5, SamuraiPlatform.Samurai, SamuraiWeapon.Bow);
        this.createReinforcement(alliance, position, 0, 4, 5, SamuraiPlatform.Ashigaru, SamuraiWeapon.Cannon);

        this.createReinforcement(alliance, position, 1, 0, 6, SamuraiPlatform.Ashigaru, SamuraiWeapon.Yari);
        this.createReinforcement(alliance, position, 1, 1, 6, SamuraiPlatform.Samurai, SamuraiWeapon.Yari);
        this.createReinforcement(alliance, position, 1, 2, 6, SamuraiPlatform.Ashigaru, SamuraiWeapon.Katana);
        this.createReinforcement(alliance, position, 1, 3, 6, SamuraiPlatform.Samurai, SamuraiWeapon.Katana);
        this.createReinforcement(alliance, position, 1, 4, 6, SamuraiPlatform.Ashigaru, SamuraiWeapon.Naginata);
        this.createReinforcement(alliance, position, 1, 5, 6, SamuraiPlatform.Samurai, SamuraiWeapon.Naginata);

        this.createReinforcement(alliance, position, 2, 0, 5, SamuraiPlatform.Cavalry, SamuraiWeapon.Yari);
        this.createReinforcement(alliance, position, 2, 1, 5, SamuraiPlatform.Cavalry, SamuraiWeapon.Katana);
        this.createReinforcement(alliance, position, 2, 2, 5, SamuraiPlatform.Cavalry, SamuraiWeapon.Naginata);
        this.createReinforcement(alliance, position, 2, 3, 5, SamuraiPlatform.Cavalry, SamuraiWeapon.Bow);
        this.createReinforcement(alliance, position, 2, 4, 5, SamuraiPlatform.Cavalry, SamuraiWeapon.Arq);
    }

    createReinforcement(alliance: Alliance, position: number, level: number, index: number, count: number,
                        platform: SamuraiPlatform, weapon: SamuraiWeapon) {
        const placement: vec2 = {x: level, y: count > 1 ? index - 0.5 * (count - 1.0) : 0.0};
        const radius = 512.0 + 30.0 * (placement.x + 1);
        const radians = 40.0 * placement.y / radius + (position === 1 ? 1.0 : 3.0) * 0.5 * 3.1415926535;

        this.battleFederation.objects<DeploymentUnit>('DeploymentUnit').create({
            hostingPlayerId: this.playerId,
            alliance: alliance,
            position: {x: 512 + radius * Math.cos(radians), y: 512 + radius * Math.sin(radians)},
            platform: platform,
            weapon: weapon,
            reinforcement: true,
            deletable: true
        });
    }
}

new ScenarioRunner((playerId: string) => new SandboxScenario(playerId));