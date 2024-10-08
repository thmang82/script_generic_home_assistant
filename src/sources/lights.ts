import { ParameterType } from "@script_types/spec/spec_parameter";
import { CallbackChangeNotify, SourceBase } from "./_sources";
import { SourceDeviceLights } from '@script_types/sources/devices/source_device_lights';
import { sendToDisplay, verbose } from "../script";
import { EntityLight } from "../types/type_lights";
import { HaApi } from "../types/type_base";
import { Setup } from "../setup";
import { sRegistry } from "../registry";
import { LightStateExt } from "../types/type_extended";
import { getStateExt, recomputeLocations } from "./_locations";

const log_pre = "lights";

export class SourceLights implements SourceBase<EntityLight.State> {

    public readonly entity_type = "light";

    public lights: LightStateExt[] = [];

    private change_cb_: CallbackChangeNotify | undefined;
    public setChangeHandler = (cb: CallbackChangeNotify): void => {
        this.change_cb_ = cb;
    }

    /** Called from the registry when it was updated */
    public registryUpdated = () => {
        let new_arr = recomputeLocations(log_pre, this.lights);
        if (new_arr) {
            this.lights = new_arr;
        }
        // The locations in the lights might have changed, transmit the change to display ...
        this.transmitStateToDisplay();
    }

    public getConfigParameters = (): { dropdown_entries: ParameterType.DropdownEntry[] } => {
        console.debug("SourceLights: getConfigParameters ...");
        return {
            dropdown_entries: this.lights.map(e => {
                return {
                    value: e.entity_id,
                    name: e.attributes.friendly_name
                }
            })
        }
    }

    public setStates = (states: EntityLight.State[]) => {
        console.log("SourceLights: setStates: ", states);
        const added_arr: EntityLight.State[] = [];
        states.forEach(state => {
            const id = state.entity_id;
            const i = this.lights.findIndex(e => e.entity_id == id);
            if (i >= 0) {
                this.lights[i] = getStateExt(state, this.lights[i]); // we need to copy over the location_ids => is done in getStateExt
            } else {
                added_arr.push(state);
                this.lights.push(state);
            }
        })
        if (added_arr.length > 0) {
            recomputeLocations(log_pre, this.lights, added_arr);
        }
        this.transmitStateToDisplay();
    }

    public stateChange = (change: HaApi.EventStateChange<EntityLight.State>) => {
        console.log("SourceLights: stateChange: ", change);
        const id = change.data.entity_id;
        const i = this.lights.findIndex(e => e.entity_id == id);
        const new_state = change.data.new_state;
        if (i >= 0) {
            this.lights[i] = getStateExt(new_state, this.lights[i]); // we need to copy over the location_ids => is done in getStateExt
        } else {
            recomputeLocations(log_pre, this.lights, [ new_state ]);
            this.lights.push(new_state);
        }
        this.transmitStateToDisplay();
    }

    private convertToLightStatus = (e: LightStateExt): SourceDeviceLights.LightStatus => {
        const rename = Setup.renamings.find(r => e.entity_id == r.device_id?.value)?.name?.value;
        const data: SourceDeviceLights.LightStatus = {
            ident: e.entity_id,
            name: rename ? rename : e.attributes.friendly_name,
            brightness: e.attributes.brightness,
            state: e.state,
            supported_color_modes: [],
            location_ids: e.location_ids ? e.location_ids : [ sRegistry.getLocationAll().id ]
        };
        e.attributes.supported_color_modes.forEach(e => {
            if (e != "white" && e !== "unknown") {
                data.supported_color_modes.push(e);
            }
        });
        const mode = e.attributes.color_mode;
        if (mode !== "white" && mode !== "unknown") {
            data.color_mode = mode;
            if (e.attributes.min_color_temp_kelvin && e.attributes.max_color_temp_kelvin) {
                data.range_color_temp_kelvin = {
                    min: e.attributes.min_color_temp_kelvin,
                    max: e.attributes.max_color_temp_kelvin
                }
            }
            if (e.attributes.color_temp_kelvin !== undefined) {
                data.color_temp_kelvin = e.attributes.color_temp_kelvin;
            }
            if (e.attributes.xy_color) {
                data.color_xy = { x: e.attributes.xy_color[0], y: e.attributes.xy_color[1] }
            }
            if (e.attributes.hs_color) {
                data.color_hs = { h: e.attributes.hs_color[0], s: e.attributes.hs_color[1] }
            }
            if (e.attributes.rgb_color) {
                data.color_rgb = { r: e.attributes.rgb_color[0], g: e.attributes.rgb_color[1], b: e.attributes.rgb_color[2] }
            }
            if (e.attributes.rgbw_color) {
                data.color_rgbw = { r: e.attributes.rgbw_color[0], g: e.attributes.rgbw_color[1], b: e.attributes.rgbw_color[2], w: e.attributes.rgbw_color[3] }
            }
            if (e.attributes.rgbww_color) {
                data.color_rgbww = { r: e.attributes.rgbww_color[0], g: e.attributes.rgbww_color[1], b: e.attributes.rgbww_color[2], w: e.attributes.rgbww_color[3], ww: e.attributes.rgbww_color[3] }
            }
        }
        return data;
    }

    public handleDataRequestDisplay = async (_params: object): Promise<SourceDeviceLights.Data> => {
        const lights = this.lights.map(this.convertToLightStatus);
        if (verbose) {
            console.debug("send lights: ", lights, Setup.renamings);
        }
        return {
            lights
        }
    }

    private transmitStateToDisplay = async () => {
        const data = await this.handleDataRequestDisplay({});
        if (sendToDisplay) {
            sendToDisplay("device_lights", data);
        }  else {
            console.error("SourceLights: sendToDisplay missing!");
        }
        if (this.change_cb_) {
            this.change_cb_();
        }
    }

    /** Returns the list of commands to be send to home assistant */
    public getChangeAllInLocation = (location_id: string, cmd: "off" | "on"): EntityLight.CallService[] => {
        const calls: EntityLight.CallService[] = [];
        for (const light of this.lights) {
            if (light.location_ids && light.location_ids.indexOf(location_id) >= 0) {
                calls.push({
                    type: "call_service",
                    domain: "light",
                    service: cmd == 'on' ? "turn_on" : "turn_off",
                    target: { entity_id: light.entity_id },
                    service_data: {}
                })
            }
        }
        return calls;
    }

    public handleCommandLight = async (cmd: SourceDeviceLights.Command.Request): Promise<EntityLight.CallService | undefined> => {
        const change = cmd.change;
        const ident = change.ident;
        let light = this.lights.find(e => e.entity_id == ident);
        if (light) {
            if (verbose) {
                console.debug("Change light: ", light, change);
            }
            let state_target: "off" | "on" | undefined;
            if (change.state == "toggle") {
                if (light.state) {
                    state_target = light.state == "off" ? "on" : "off";
                }
            } else if (change.state == "on" || change.state == "off") {
                state_target = change.state;
            }
            if (state_target) {
                if (state_target == "on") {
                    let call: EntityLight.CallService = {
                        type: "call_service",
                        domain: "light",
                        service: "turn_on",
                        target: { entity_id: ident },
                        service_data: {}
                    }
                    if (change.brightness) {
                        call.service_data.brightness = change.brightness;
                    }
                    if (change.color_temp_kelvin) {
                        call.service_data.color_temp_kelvin = change.color_temp_kelvin;
                    }
                    if (change.color_xy) {
                        call.service_data.xy_color = [ change.color_xy.x, change.color_xy.y ];
                    }
                    if (change.color_hs) {
                        call.service_data.hs_color = [ change.color_hs.h, change.color_hs.s ];
                    }
                    if (change.color_rgb) {
                        call.service_data.rgb_color = [ change.color_rgb.r, change.color_rgb.g, change.color_rgb.b ];
                    }
                    if (change.color_rgbw) {
                        call.service_data.rgbw_color = [ change.color_rgbw.r, change.color_rgbw.g, change.color_rgbw.b, change.color_rgbw.w ];
                    }
                    if (change.color_rgbww) {
                        call.service_data.rgbww_color = [ change.color_rgbww.r, change.color_rgbww.g, change.color_rgbww.b, change.color_rgbww.w, change.color_rgbww.ww ];
                    }
                    return call;
                } else {
                    return {
                        type: "call_service",
                        domain: "light",
                        service: "turn_off",
                        target: { entity_id: ident }
                    }
                }
            }
        } else {
            console.error("Could not find light: ", ident);
        }
        return undefined;
    }

    public getActiveLights = (): SourceDeviceLights.LightStatus[] => {
        const active_l = this.lights.filter(e => e.state == "on").map(this.convertToLightStatus);
        return active_l;
    }

    /*
    private turnOn = () => {
        const msg = { type: "turn_on", brightness: 50 };

    }
    */
}