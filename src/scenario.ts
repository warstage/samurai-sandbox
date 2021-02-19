import {Subscription} from 'rxjs';
import {
    Alliance,
    AssetLoader,
    Commander,
    DeploymentUnit,
    Match,
    Navigator,
    ObjectRef,
    ShapeRef,
    Slot,
    Team,
    Unit,
    UnitType,
    Value,
    Vector,
    vec2, Shape, ValueStruct, Marker, ConfigLoader
} from 'warstage-runtime';
export interface ShapeValue extends Shape, ValueStruct {}

interface ConfigUnit {
    unitType: UnitType;
    shape: ShapeValue;
    marker: Marker;
}

interface Config {
    particles: { shapes: ShapeValue[] };
    vegetation: { shapes: ShapeValue[] };
    units: { [name: string]: ConfigUnit };
}

enum ScenarioMode { Sandbox = 0, Editor = 1 };

export class Scenario {
    private subscription: Subscription;
    private match: Match;

    private config: Config = null;
    private readonly mode: ScenarioMode = ScenarioMode.Sandbox;

    constructor(private navigator: Navigator, mode: string) {
        if (mode === 'editor') {
            this.mode = ScenarioMode.Editor;
        }
    }

    getParams(): Value {
        switch (this.mode) {
            case ScenarioMode.Sandbox:
                return {
                    teams: [
                        {slots: [{playerId: this.navigator.system.player.playerId}]},
                        {slots: [{playerId: this.navigator.system.player.playerId}]}
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
            case ScenarioMode.Editor:
                return {
                    teams: [],
                    teamsMin: 0,
                    teamsMax: 0,
                    title: 'editor',
                    map: 'Maps/Map1.png',
                    options: {
                        map: true,
                        editor: true
                    },
                    started: true,
                    editor: true
                };
            default:
                throw new Error(`Invalid mode ${this.mode}`);
        }
    }

    startup(match: ObjectRef) {
        this.match = match as Match;

        this.navigator.battle.federation.provideService('_LoadTexture', AssetLoader.getServiceProvider());

        if (this.mode === ScenarioMode.Sandbox) {
            this.subscription = this.navigator.lobby.federation.objects<Match>('Match').subscribe(() => {
                this.recreateAlliances().then(() => {
                }, err => console.error(err));
            });

            this.subscription.add(this.navigator.lobby.federation.objects<Team>('Team').subscribe(() => {
                this.recreateAlliances().then(() => {
                }, err => console.error(err));
            }));

            this.subscription.add(this.navigator.lobby.federation.objects<Slot>('Slot').subscribe(() => {
                this.recreateAlliances().then(() => {
                }, err => console.error(err));
            }));

            this.subscription.add(this.navigator.battle.federation.objects<Unit>('Unit').subscribe(unit => {
                if ((unit.fighters$changed && !unit.fighters) || unit.deletedByGesture) {
                    unit.$delete();
                }
            }));

            this.navigator.battle.federation.observeEvents('DeployUnit', (params: {
                deploymentUnit: DeploymentUnit;
                position: vec2;
                deleted: boolean;
            }) => {
                if (!params.deleted) {
                    this.deployUnit(params.deploymentUnit, params.position);
                }
            });
        }

        this.startupAsync().then(() => {}, err => { console.error(err); })
    }

    async startupAsync() {
        await this.loadConfig();
        if (this.mode === ScenarioMode.Sandbox) {
            await this.createAlliances();
        }
    }

    async loadConfig() {
        const configLoader = new ConfigLoader(AssetLoader.getJsonLoader());
        this.config = await configLoader.load('config.json') as Config;

        for (const shape of this.config.vegetation.shapes) {
            this.navigator.battle.federation.objects<ShapeRef>('Shape').create(shape);
        }

        if (this.mode === ScenarioMode.Sandbox) {
            for (const shape of this.config.particles.shapes) {
                this.navigator.battle.federation.objects<ShapeRef>('Shape').create(shape);
            }

            for (const unit of Object.values<ConfigUnit>(this.config.units)) {
                this.navigator.battle.federation.objects<ShapeRef>('Shape').create(unit.shape);
            }
        }
    }

    shutdown() {
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
    }

    deployUnit(deploymentUnit: DeploymentUnit, position: vec2) {
        const delta: vec2 = Vector.sub([512, 512],  position);
        const facing = Vector.angle(delta);

        const alliance = deploymentUnit.alliance;
        const unitType = deploymentUnit.unitType as UnitType;
        const marker = deploymentUnit.marker;
        let commander = deploymentUnit.commander;
        if (!commander) {
            commander = this.navigator.battle.federation.objects<Commander>('Commander').find(x => x.alliance === alliance);
        }

        this.navigator.battle.federation.objects<Unit>('Unit').create({
            alliance,
            commander,
            unitType,
            marker,
            'stats.placement': {x: position[0], y: position[1], z: facing},
            deletable: true
        });
    }

    async recreateAlliances() {
        await this.removeAlliances();
        await this.createAlliances();
    }

    async removeAlliances() {
        for (const object of this.navigator.battle.federation.objects<Alliance>('Alliance')) {
            object.$delete();
        }
        for (const object of this.navigator.battle.federation.objects<Commander>('Commander')) {
            object.$delete();
        }
        for (const object of this.navigator.battle.federation.objects<DeploymentUnit>('DeploymentUnit')) {
            object.$delete();
        }
    }

    async createAlliances() {
        let position = 0;
        for (const team of this.match.teams) {
            const alliance = this.navigator.battle.federation.objects<Alliance>('Alliance').create({
                position: ++position
            });
            this.createReinforcements(alliance, position);

            for (const slot of team.slots) {
                if (slot.playerId) {
                    /*const commander =*/ this.navigator.battle.federation.objects<Commander>('Commander').create({
                        alliance,
                        playerId: slot.playerId
                    });
                }
            }
        }
    }

    createReinforcements(alliance: Alliance, position: number) {
        this.createReinforcement(alliance, position, 0, 0, 5, this.config.units.sam_arq);
        this.createReinforcement(alliance, position, 0, 1, 5, this.config.units.sam_bow);
        this.createReinforcement(alliance, position, 0, 2, 5, this.config.units.sam_yari);
        this.createReinforcement(alliance, position, 0, 3, 5, this.config.units.sam_kata);
        this.createReinforcement(alliance, position, 0, 4, 5, this.config.units.sam_nagi);

        this.createReinforcement(alliance, position, 1, 0, 6, this.config.units.ash_arq);
        this.createReinforcement(alliance, position, 1, 1, 6, this.config.units.ash_bow);
        this.createReinforcement(alliance, position, 1, 2, 6, this.config.units.ash_yari);
        this.createReinforcement(alliance, position, 1, 3, 6, this.config.units.ash_kata);
        this.createReinforcement(alliance, position, 1, 4, 6, this.config.units.ash_nagi);
        this.createReinforcement(alliance, position, 1, 5, 6, this.config.units.ash_can);

        this.createReinforcement(alliance, position, 2, 0, 5, this.config.units.cav_bow);
        this.createReinforcement(alliance, position, 2, 1, 5, this.config.units.cav_yari);
        this.createReinforcement(alliance, position, 2, 2, 5, this.config.units.cav_kata);
        this.createReinforcement(alliance, position, 2, 3, 5, this.config.units.cav_nagi);
        this.createReinforcement(alliance, position, 2, 4, 5, this.config.units.cav_can);
    }

    createReinforcement(alliance: Alliance, position: number, level: number, index: number, count: number, unit: any) {
        const radius = 512.0 + 30.0 * (level + 1);
        const place = count > 1 ? index - 0.5 * (count - 1.0) : 0.0;
        const angle = 40.0 * place / radius + (position === 1 ? 1.0 : 3.0) * 0.5 * 3.1415926535;

        this.navigator.battle.federation.objects<DeploymentUnit>('DeploymentUnit').create({
            hostingPlayerId: this.navigator.system.player.playerId,
            alliance: alliance,
            unitType: unit.unitType,
            marker: unit.marker,
            position: Vector.add(Vector.fromPolar(radius, angle), [512, 512]),
            reinforcement: true,
            deletable: true
        });
    }
}
