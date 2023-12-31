import { Script } from '@script_types/script/script';
import { ScriptConfig } from '../gen/spec_config'; /* File will be automatically generated by compiler! Run "nom run cli install" */
import { specification } from './spec';
import { AssistantMessages } from './socket_messages';
import { AsssistantCommand } from './socket_command';
import { SourceLights } from './sources/lights';
import { SourceCovers } from './sources/covers';
import { ParameterType } from '@script_types/spec/spec_parameter';
import { ScriptCtxUI } from '@script_types/script/context_ui/context_ui';
import { DataSourcesTypes } from '@script_types/sources/sources_types';

type ProvidedSources = "compute" | "device_lights" | "device_covers";

export let sendToDisplay: FnSendToDisplay | undefined;
export type FnSendToDisplay = <T extends ProvidedSources>(ident: T, data: DataSourcesTypes.MapData<T>) => void;

export interface SocketInfo {
    uid: string;
}

export let verbose = false;

export let renamings: {
    device_id?: { value: string ,  name: string };
    name?: { value: string ,  name: string };
}[] = [];

export class MyScript implements Script.Class<ScriptConfig> {

    private msg_id = 1;
    private cmd_handler: AsssistantCommand;
    private msg_handler: AssistantMessages;
    
    private config: ScriptConfig | undefined;
    private ctx: Script.Context | undefined;
    private socket_info: SocketInfo | undefined;

    constructor(){
        sendToDisplay = this.sendToDisplay;
        this.cmd_handler = new AsssistantCommand({ sendMessage: this.sendMessage });
        this.msg_handler = new AssistantMessages({
            cmd_: this.cmd_handler,
            sendData: this.sendData,
            sendMessage: this.sendMessage,
            getToken: this.getToken
        });
    }

    public getToken = (): string | undefined => {
        return this.config?.token?.value;
    }

    start = async (ctx: Script.Context, config: ScriptConfig): Promise<void> => {
        this.ctx = ctx;
        this.config = config;

        console.info("Ident:" + specification.id_ident);
        console.info("Config:", config);

        if (config.device_rename) {
            renamings = config.device_rename;
        }
        if (config.verbose_log) {
            verbose = config.verbose_log.value;
        }

        let host = config.host?.value;
        const token = config.token?.value;
        if (host && token) {

            if (!host.startsWith("ws://")) {
                host = "ws://" + host;
            }
            console.debug("split test: ", host.split(":"));
            if (host.split(":").length == 2) { // there is one in ws://, check if the one for the port exists, should be 3 elements. If only 2, add the port
                host = host + ":8123";
            }
            const url = host + "/api/websocket";
            console.log(`Connect to ${url} ...`);

            const socket_info = {
                uid: "",
            }
            const result = await ctx.data.websocket.connect(url, (data) => this.msg_handler.onDataReceived(data, socket_info), {
                auto_reconnect: true,
                state_handler: (state) => {
                    console.log(`Socket '${state.uid}' state: ${state.connected ? 'connected' : 'disconnected'}`);
                    if (!state.connected) {
                        this.socket_info = undefined;
                    } else {
                        this.socket_info = {
                            uid: state.uid
                        }
                    }
                }
            });
            console.debug(`Connect result: `, result);
            if (result.uid) {
                socket_info.uid = result.uid;
                this.socket_info = socket_info;
            }
        } else {
            if (!host) console.error("Config incomplete: host not given");
            if (!token) console.error("Config incomplete: token not given");
        }

        const handleSubscriptionResult = (result: { error: string | undefined }) => {
            if (result.error) console.error(result.error);
        }

        ctx.ui.subscribeDataRequests<"device_lights">("device_lights", this.dataRequestLights).then(handleSubscriptionResult);
        ctx.ui.subscribeDataRequests<"device_covers">("device_covers", this.dataRequestCovers).then(handleSubscriptionResult);

        ctx.ui.subscribeCommands<"device_lights">("device_lights", this.executeCommandLights).then(handleSubscriptionResult);
        ctx.ui.subscribeCommands<"device_covers">("device_covers", this.executeCommandCovers).then(handleSubscriptionResult);

        ctx.ui.registerConfigOptionsProvider(async (req) => {
            let ident = req.parameter_ident;
            console.debug("Config req: ", req);
            if (req.source == "widget") {
                if (ident == "light") {
                    // This is a request from the "light widget" selector!
                    const s_light = <SourceLights | undefined> this.msg_handler.getSourceRef("light");
                    if (s_light) {
                        return s_light.getConfigParameters();
                    } else {
                        return { no_data: 'DataMissing' };
                    }
                } else if (ident == "cover") {
                    // This is a request from the "cover widget" selector!
                    const s_cover = <SourceCovers | undefined> this.msg_handler.getSourceRef("cover");
                    if (s_cover) {
                        return s_cover.getConfigParameters();
                    } else {
                        return { no_data: 'DataMissing' };
                    }
                } else {
                    console.error("Config Options Req: UnkownID: ", ident);
                    return { no_data: 'UnknownID' };
                }
            } else if (req.source == "script_instance") {
                if (ident == "device_id") {
                    // for renaming
                    let entries: ParameterType.DropdownEntry[] = [];
                    const s_cover = <SourceCovers | undefined> this.msg_handler.getSourceRef("cover");
                    if (s_cover) {
                        const entries_t = s_cover.getConfigParameters().dropdown_entries;
                        entries_t.forEach(e => { e.name = "Cover: " + e.name });
                        entries = entries.concat(entries_t);
                    }
                    const s_light = <SourceLights | undefined> this.msg_handler.getSourceRef("light");
                    if (s_light) {
                        const entries_t = s_light.getConfigParameters().dropdown_entries;
                        entries_t.forEach(e => { e.name = "Light: " + e.name });
                        entries = entries.concat(entries_t);
                    }
                    return {
                        dropdown_entries: entries
                    }
                }
            }
            return {
                no_data: "UnknownID"
            };
        });   
    }

    public sendToDisplay = <T extends ProvidedSources>(ident: T, data: DataSourcesTypes.MapData<T>) => {
        if (this.config?.verbose_log) {
            console.debug(`sendToDisplay: '${ident}': `, data);
        }
        this.ctx?.ui.transmitData(ident, data);
    }

    private sendData = (msg: any) => {
        if (!this.socket_info) {
            console.error("sendData: no socket");
            return;
        }
        this.ctx?.data.websocket.sendData(this.socket_info.uid, msg);
    }

    private sendMessage = (msg: object): number | undefined => {
        if (!this.socket_info) {
            console.error("sendMessage: no active socket");
            return undefined;
        }
        this.msg_id ++;
        const id = this.msg_id;
        // we need to add an increasing message id - https://developers.home-assistant.io/docs/api/websocket/
        const tx_msg = Object.assign(msg, { id });
        this.ctx?.data.websocket.sendData(this.socket_info.uid, tx_msg);
        return id;
    }


    stop = async (_reason: Script.StopReason): Promise<void> => {
        console.info("Stopping all my stuff ...");
        if (this.socket_info) {
            const res = await this.ctx?.data.websocket.disconnect(this.socket_info.uid);
            console.debug(`Disconnect from '${this.config?.host?.value}' result: `, res);
        }
    }

    public dataRequestLights: ScriptCtxUI.DataRequestCallback<"device_lights"> = async (req_params) => {
        console.debug(`dataRequestLights ...`);
        const s_light = <SourceLights | undefined> this.msg_handler.getSourceRef("light");
        if (s_light) {
            const data = await s_light.handleDataRequestDisplay(req_params);
            if (this.config?.verbose_log) {
                console.debug(`dataRequestLights: send: `, data);
            }
            return data;
        } else {
            console.error("dataRequest: No 'light' service found")
        }
        return undefined;
    }

    public dataRequestCovers: ScriptCtxUI.DataRequestCallback<"device_covers"> = async (req_params) => {
        console.debug(`dataRequestCovers ...`);
        const s_cover = <SourceCovers | undefined> this.msg_handler.getSourceRef("cover");
        if (s_cover) {
            const data = await s_cover.handleDataRequestCover(req_params);
            if (this.config?.verbose_log) {
                console.debug(`dataRequestCovers: send: `, data);
            }
            return data;
        } else {
            console.error("dataRequest: No 'cover' service found")
        }
        return undefined;
    };

    public executeCommandLights: ScriptCtxUI.CommandCallback<"device_lights"> = async (cmd, _env) => {
        console.log("executeCommandLights: ", cmd);
        const s_light = <SourceLights | undefined> this.msg_handler.getSourceRef("light");
        if (s_light) {
            const ha_msg = await s_light.handleCommandDisplay(cmd);
            if (ha_msg) {
                this.sendMessage(ha_msg);
                return { success: true };
            } else {
                console.warn(`executeCommandLights: No handler found for ${cmd.change.ident}`);
            }
        } else {
            console.error("executeCommandLights: No 'light' service found")
        }
        return undefined;
    }
    
    public executeCommandCovers: ScriptCtxUI.CommandCallback<"device_covers"> = async (cmd, _env) => {
        console.log("executeCommandCovers: ", cmd);
        const s_cover = <SourceCovers | undefined> this.msg_handler.getSourceRef("cover");
        if (s_cover) {
            const ha_msg = await s_cover.handleCommandCover(cmd);
            if (ha_msg) {
                this.sendMessage(ha_msg);
                return { success: true };
            } else {
                console.warn(`executeCommandCovers: No handler found for ${cmd.change.ident}`);
            }
        } else {
            console.error("executeCommandCovers: No 'cover' service found")
        }
        return undefined;
    }
  
}

export const script = new MyScript();