import { DataSource } from '../../toolchain/types/spec/spec_source';

export const specification: DataSource.Specification = {
    category:  "generic",
    id_ident:  "home_assistant",
    id_author: "thmang82",
    // ---
    provides: [ "compute", "device_lights", "device_covers", "devices_overview" ],
    // ---
    version:   "0.2.8",
    // ---
    author_email: "",
    translations: {
        'en' : { 
            name: "Home Assistant",
            description: "Home Assistant"
        }
    },
    // ---
    parameters: [
        /* Define script parameters here that shall be rendered by the WunderView Config GUI */
        /* See spec in toolchain/types/spec/spec_parameter.ts for help */
        /* You can also use auto complete, or check the examples */
        {
            type: "TextField",
            ident: "host",
            value_example: "server.lan:8123",
            translations: {
                'en': {
                    name: "Host address",
                    description: "The host of your Home Assistant server. Must be in format hostname[:port] (port is optional, defaults to 8123)"
                }
            },
            validate: [ /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/, /^[\d\w_]+(\.lan)?(:\d+)?$/ ],
            value_default: undefined,
            value_type: "string"
        },
        {
            type: "TextField",
            ident: "token",
            value_example: "",
            translations: {
                'en': {
                    name: "Access Token",
                    description: "A long-lived access token for your Home Assistant server. Go to http://yourserver:port/profile and scroll down. There, you can create a long-lived token that is valid for 10 years. Use it here."
                }
            },
            // validate: undefined,
            validate: [ /^[a-zA-Z0-9-_]+\.+[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/ ],
            value_default: undefined,
            value_type: "string"
        },
        {
            type: "Checkbox",
            ident: "verbose_log",
            translations: {
                'en': {
                    name: "Verbose logging",
                    description: undefined
                }
            },
            value_default: false,
            value_type: 'boolean'
        },
        {
            type: "EntryList",
            ident: "device_rename",
            translations: {
                'en': {
                    name: "Rename Devices",
                    description: "Add devices that you want to rename to the list"
                }
            },
            parameters: [
                {
                    type: "DropDownList",
                    entries: [],
                    req_source: true,
                    auto_complete: false,
                    ident: "device_id",
                    translations: {
                        'en': {
                            name:  "Device",
                            description: undefined
                        }
                    },
                    value_type: "string"
                },
                {
                    type: "TextField",
                    ident: "name",
                    translations: {
                        'en': {
                            name:  "New Name",
                            description: undefined
                        }
                    },
                    value_type: "string",
                    validate: undefined,
                    value_default: undefined,
                    value_example: "Table"
                }
            ]
        },
        {
            type: "EntryList",
            ident: "window_setup",
            translations: {
                'en': {
                    name: "Window Setup",
                    description: "Add window sensors to the list for classifing them"
                }
            },
            parameters: [
                {
                    type: "DropDownList",
                    entries: [],
                    req_source: true,
                    auto_complete: false,
                    ident: "window_sensor_id",
                    translations: {
                        'en': {
                            name:  "Sensor",
                            description: undefined
                        }
                    },
                    require_select: true, // A sensor ID must be selected, otherwise makes no sense
                    value_type: "string"
                },
                {
                    type: "DropDownList",
                    entries: [],
                    req_source: true,
                    auto_complete: false,
                    ident: "window_type",
                    translations: {
                        'en': {
                            name:  "Window Type",
                            description: undefined
                        }
                    },
                    require_select: true, // A window type must be selected, otherwise makes no sense
                    value_type: "string"
                },
                {
                    type: "DropDownList",
                    entries: [
                        {
                            value: "ORANGE",
                        }, 
                        {
                            value: "GREEN"
                        },
                        {
                            value: "BLUE",
                        }, 
                        { 
                            value: "PURPLE"
                        }
                    ],
                    req_source: false,
                    auto_complete: false,
                    ident: "color_active",
                    translations: {
                        'en': {
                            name:  "Active Color",
                            description: undefined
                        }
                    },
                    value_type: "string"
                }
            ]
        },
        {
            type: "EntryList",
            ident: "floors",
            translations: {
                'en': {
                    name: "Floors",
                    description: "HomeAssistant is lacking an 'area containing areas' feature. This allows to create floors and assign areas (rooms) to it. This can be handy for showing the state of a floor"
                }
            },
            parameters: [
                {
                    type: "MultiSelect",
                    entries: [],
                    req_source: true,
                    ident: "area_ids",
                    translations: {
                        'en': {
                            name:  "Covered Areas",
                            description: undefined
                        }
                    },
                    require_select_num: 1 // At least one area is needed, empty makes no sense
                },
                {
                    type: "TextField",
                    ident: "floor_name",
                    translations: {
                        'en': {
                            name:  "Name",
                            description: undefined
                        }
                    },
                    value_type: "string",
                    validate: undefined,
                    value_default: undefined,
                    value_example: "1st Floor"
                },
                {
                    type: "TextField",
                    ident: "ident",
                    translations: {
                        'en': {
                            name:  "Unique Identifer",
                            description: "Keep as stable as possible"
                        }
                    },
                    value_type: "string",
                    validate: [ /^[a-zA-Z0-9_]{3,30}$/ ],
                    value_default: undefined,
                    value_example: "floor_1"
                }
            ]
        }
    ],
    notifications: [],
    geo_relevance: { 
        everywhere: true
    },
    data_fetch: {
        // Note: setting data_fetch to undefined will disable automatic fetching! You have to take care for yourself then, e.g. by subscribing to visiblity changes via ctx.script.visSubscribe
        interval_active_sec: 5 * 60, // Fetch data every  5 minutes in case at least one screen showing data from this source is in state 'active'
        interval_idle_sec: 15 * 60   // Fetch data every 15 minutes in case at least one screen showing data from this source is in state '(active) idle'
    }
}