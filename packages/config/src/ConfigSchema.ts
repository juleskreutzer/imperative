/*
* This program and the accompanying materials are made available under the terms of the
* Eclipse Public License v2.0 which accompanies this distribution, and is available at
* https://www.eclipse.org/legal/epl-v20.html
*
* SPDX-License-Identifier: EPL-2.0
*
* Copyright Contributors to the Zowe Project.
*
*/

import { IProfileSchema, IProfileTypeConfiguration } from "../../profiles";

export class ConfigSchema {
    /**
     * JSON schema URI stored in $schema property of the schema
     * @readonly
     * @memberof ConfigSchema
     */
    private static readonly JSON_SCHEMA = "https://json-schema.org/draft/2019-09/schema#";

    /**
     * Version number stored in $version property of the schema
     * @readonly
     * @memberof ConfigSchema
     */
    private static readonly SCHEMA_VERSION = 1;

    /**
     * Transform an Imperative profile schema to a JSON schema. Removes any
     * non-JSON-schema properties and translates anything useful.
     * @param schema The Imperative profile schema
     * @returns JSON schema for profile properties
     */
    private static transformSchema(schema: IProfileSchema): any {
        const properties: { [key: string]: any } = {};
        for (const [k, v] of Object.entries(schema.properties)) {
            properties[k] = { type: v.type };
            if ((v as any).optionDefinition != null) {
                properties[k].description = (v as any).optionDefinition.description;
                properties[k].default = (v as any).optionDefinition.defaultValue;
            }
            if (v.secure) {
                properties[k].secure = true;
            }
        }
        return {
            type: schema.type,
            title: schema.title,
            description: schema.description,
            properties,
            required: schema.required
        };
    }

    /**
     * Dynamically builds the config schema for this CLI.
     * @param profiles The profiles supported by this CLI
     * @returns JSON schema for all supported profile types
     */
    public static buildSchema(profiles: IProfileTypeConfiguration[]): any {
        const entries: any[] = [];
        profiles.forEach((profile: { type: string, schema: IProfileSchema }) => {
            entries.push({
                if: { properties: { type: { const: profile.type } } },
                then: { properties: { properties: this.transformSchema(profile.schema) } },
            });
        });
        return {
            $schema: ConfigSchema.JSON_SCHEMA,
            $version: ConfigSchema.SCHEMA_VERSION,
            type: "object",
            description: "config",
            properties: {
                profiles: {
                    type: "object",
                    description: "named profiles config",
                    patternProperties: {
                        "^\\S*$": {
                            type: "object",
                            description: "a profile",
                            properties: {
                                type: {
                                    description: "the profile type",
                                    type: "string"
                                },
                                properties: {
                                    description: "the profile properties",
                                    type: "object"
                                },
                                profiles: {
                                    description: "additional sub-profiles",
                                    type: "object",
                                    $ref: "#/properties/profiles"
                                }
                            },
                            allOf: entries
                        }
                    }

                },
                defaults: {
                    type: "object",
                    description: "default profiles config",
                    patternProperties: {
                        "^\\S*$": {
                            type: "string",
                            description: "the type"
                        }
                    }
                },
                secure: {
                    type: "array",
                    description: "secure properties",
                    items: {
                        type: "string",
                        description: "path to a property"
                    }
                }
            }
        };
    }
}
