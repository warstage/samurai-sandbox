// Copyright Felix Ungman. All rights reserved.
// Licensed under GNU General Public License version 3 or later.

import {
    Alliance,
    Commander,
    DeploymentUnit,
    Federation,
    Match,
    ObjectRef,
    RuntimeConfiguration,
    Scenario,
    ScenarioRunner,
    ShapeRef,
    Slot,
    Team,
    Unit,
    UnitType,
    Value,
    vec2
} from 'warstage-runtime';
import {Subscription} from 'rxjs';

import * as lines from './lines';
import * as shapes from './shapes';
import * as skins from './skins';
import * as units from './units';


RuntimeConfiguration.autoRedirect();

export class SandboxScenario implements Scenario {
    private subscription: Subscription;
    private match: Match;
    private arenaFederation: Federation;
    private battleFederation: Federation;

    static getBasePath(pathname: string): string {
        const i = pathname.lastIndexOf('/');
        return i === -1 ? '' : pathname.substring(0, i + 1);
    }

    static getBaseHref(location: Location) {
        return location.protocol + '//'
            + location.hostname + (location.port ? ':' + location.port : '')
            + SandboxScenario.getBasePath(location.pathname);
    }

    static loadTexture(name: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            const url = SandboxScenario.getBaseHref(window.location) + 'assets/' + name;
            request.open('GET', url, true);
            request.responseType = 'arraybuffer';
            request.onload = () => {
                const arrayBuffer = request.response;
                if (arrayBuffer) {
                    resolve({data: new Uint8Array(arrayBuffer)});
                } else {
                    reject('no response');
                }
            };
            request.onabort = (e) => {
                reject('aborted loading ' + url);
            };
            request.onerror = (e) => {
                reject('error while loading ' + url);
            };
            request.send(null);
        });
    }

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

        this.battleFederation.provideService('LoadTexture', (params: {name: string}) => {
            return SandboxScenario.loadTexture(params.name);
        });

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

        for (const shape of shapes.vegetation) {
            this.battleFederation.objects<ShapeRef>('Shape').create(shape);
        }

        for (const shape of shapes.particles) {
            this.battleFederation.objects<ShapeRef>('Shape').create(shape);
        }

        for (const unit of Object.values(units)) {
            this.battleFederation.objects<ShapeRef>('Shape').create({
                name: unit.unitType.subunits[0].element.shape,
                size: unit.shape.size,
                skins: unit.shape.skin ? [skins[unit.shape.skin]] : null,
                lines: unit.shape.line ? [lines[unit.shape.line]] : null,
            });
        }
    }

    shutdown() {
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
    }

    deployUnit(deploymentUnit: DeploymentUnit, position: vec2) {
        const delta = {x: 512 - position.x, y: 512 - position.y};
        const facing = Math.atan2(delta.y, delta.x);

        const alliance = deploymentUnit.alliance;
        const unitType = deploymentUnit.unitType as UnitType;
        const marker = deploymentUnit.marker;
        let commander = deploymentUnit.commander;
        if (!commander) {
            commander = this.battleFederation.objects<Commander>('Commander').find(x => x.alliance === alliance);
        }

        this.battleFederation.objects<Unit>('Unit').create({
            alliance,
            commander,
            unitType,
            marker,
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
        this.createReinforcement(alliance, position, 0, 0, 5, units.sam_arq);
        this.createReinforcement(alliance, position, 0, 1, 5, units.sam_bow);
        this.createReinforcement(alliance, position, 0, 2, 5, units.sam_yari);
        this.createReinforcement(alliance, position, 0, 3, 5, units.sam_kata);
        this.createReinforcement(alliance, position, 0, 4, 5, units.sam_nagi);

        this.createReinforcement(alliance, position, 1, 0, 6, units.ash_arq);
        this.createReinforcement(alliance, position, 1, 1, 6, units.ash_bow);
        this.createReinforcement(alliance, position, 1, 2, 6, units.ash_yari);
        this.createReinforcement(alliance, position, 1, 3, 6, units.ash_kata);
        this.createReinforcement(alliance, position, 1, 4, 6, units.ash_nagi);
        this.createReinforcement(alliance, position, 1, 5, 6, units.ash_can);

        this.createReinforcement(alliance, position, 2, 0, 5, units.cav_bow);
        this.createReinforcement(alliance, position, 2, 1, 5, units.cav_yari);
        this.createReinforcement(alliance, position, 2, 2, 5, units.cav_kata);
        this.createReinforcement(alliance, position, 2, 3, 5, units.cav_nagi);
        this.createReinforcement(alliance, position, 2, 4, 5, units.cav_can);
    }

    createReinforcement(alliance: Alliance, position: number, level: number, index: number, count: number, unit: any) {
        const placement: vec2 = {x: level, y: count > 1 ? index - 0.5 * (count - 1.0) : 0.0};
        const radius = 512.0 + 30.0 * (placement.x + 1);
        const radians = 40.0 * placement.y / radius + (position === 1 ? 1.0 : 3.0) * 0.5 * 3.1415926535;

        this.battleFederation.objects<DeploymentUnit>('DeploymentUnit').create({
            hostingPlayerId: this.playerId,
            alliance: alliance,
            unitType: unit.unitType,
            marker: unit.marker,
            position: {x: 512 + radius * Math.cos(radians), y: 512 + radius * Math.sin(radians)},
            reinforcement: true,
            deletable: true
        });
    }
}

new ScenarioRunner((playerId: string) => new SandboxScenario(playerId));