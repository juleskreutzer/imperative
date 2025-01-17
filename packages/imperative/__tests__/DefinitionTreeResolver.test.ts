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

import { DefinitionTreeResolver } from "../src/DefinitionTreeResolver";
import { ImperativeError } from "../../error";
import { Logger } from "../../logger";
import { Console } from "../../console";

describe("DefinitionTreeResolver tests", () => {

    it("should error without commands", () => {
        let error;
        try {
            DefinitionTreeResolver.resolve("", "", "", new Logger(new Console()));
        } catch (thrownError) {
            error = thrownError;
        }
        expect(error instanceof ImperativeError).toBe(true);
        expect(error.message).toMatchSnapshot();
    });

    it("should error with unmatching globs commands", () => {
        let error;
        try {
            DefinitionTreeResolver.resolve("", "", "/random/caller/dir", new Logger(new Console()), [], ["**/bad/glob"]);
        } catch (thrownError) {
            error = thrownError;
        }
        expect(error instanceof ImperativeError).toBe(true);
        expect(error.message).toMatchSnapshot();
    });

    it("should match on glob with dummy handler", () => {
        const def = DefinitionTreeResolver.resolve("", "", __dirname, new Logger(new Console()), [], ["**/*.definition!(.d).*s"]);
        expect(def.children).toBeDefined();
        expect(def.children.length).toBe(1);
        expect(def.children[0].profile).toBeDefined();
        expect(def.children[0].profile.required).toEqual(["sample"]);
        expect(def.children[0].profile.optional).toBeUndefined();
    });

    it("should match on glob with dummy handler and add base profile", () => {
        const def = DefinitionTreeResolver.resolve("", "", __dirname, new Logger(new Console()), [], ["**/*.definition!(.d).*s"], true);
        expect(def.children).toBeDefined();
        expect(def.children.length).toBe(1);
        expect(def.children[0].profile).toBeDefined();
        expect(def.children[0].profile.required).toEqual(["sample"]);
        expect(def.children[0].profile.optional).toEqual(["base"]);
    });
});
