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

import * as childProcess from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ITestEnvironment } from "../../../../../../../__src__/environment/doc/response/ITestEnvironment";
import { SetupTestEnvironment } from "../../../../../../../__src__/environment/SetupTestEnvironment";
import { runCliScript } from "../../../../../../../src/TestUtil";

// Test Environment populated in the beforeAll();
let TEST_ENVIRONMENT: ITestEnvironment;

/**
 * Compare that the contents of 2 files are equal, after normalizing line endings.
 */
function expectFilesAreEqual(file1: string, file2: string): void {
    const file1Data = fs.readFileSync(file1, "utf-8").replace(/\r?\n/g, os.EOL);
    const file2Data = fs.readFileSync(file2, "utf-8").replace(/\r?\n/g, os.EOL);
    expect(file1Data).toBe(file2Data);
}

describe("imperative-test-cli config import", () => {
    let pServer: any;
    let localhostUrl: string;

    // Create the test environment
    beforeAll(async () => {
        TEST_ENVIRONMENT = await SetupTestEnvironment.createTestEnv({
            cliHomeEnvVar: "IMPERATIVE_TEST_CLI_CLI_HOME",
            testName: "imperative_test_cli_test_config_init_command"
        });

        // Spawn a localhost HTTP file server with "npx serve" command
        pServer = childProcess.spawn(process.platform === "win32" ? "npx.cmd" : "npx",
            ["serve", __dirname + "/__resources__"]);

        // Retrieve server URL from the end of first line printed to stdout
        localhostUrl = await new Promise((resolve, reject) => {
            pServer.stdout.on("data", (data: Buffer) => {
                resolve(data.toString().trim().split(" ").pop());
            });
        });
    });

    afterAll(() => {
        // Kill server process with Ctrl+C and unref it so that Jest exits
        pServer.kill("SIGINT");
        pServer.unref();
        pServer.stdin.unref();
        pServer.stdout.unref();
        pServer.stderr.unref();
    });

    beforeEach(() => {
        runCliScript(__dirname + "/../__scripts__/create_directory.sh", TEST_ENVIRONMENT.workingDir, ["fakeHome"]);
        process.env.IMPERATIVE_TEST_CLI_CLI_HOME = path.join(TEST_ENVIRONMENT.workingDir, "fakeHome");
    });

    afterEach(() => {
        runCliScript(__dirname + "/../__scripts__/delete_configs.sh", TEST_ENVIRONMENT.workingDir, ["-rf test fakeHome *.json"]);
    });

    describe("success scenarios", () => {

        it("should display the help", () => {
            const response = runCliScript(__dirname + "/../__scripts__/get_help.sh", TEST_ENVIRONMENT.workingDir, ["import"]);
            const expectedLines = [
                "Import config files from another location on disk or from an Internet URL.",
                "File path or URL to import from.",
                "Target the global config files.",
                "Target the user config files.",
                "Overwrite config file if one already exists."
            ];
            expectedLines.forEach((line: string) => expect(response.output.toString()).toContain(line));
            expect(response.error).not.toBeDefined();
            expect(response.stderr.toString()).toEqual("");
        });

        it("should successfully import and overwrite a schema and config", () => {
            let response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                path.join(__dirname, "__resources__", "test.config.good.with.schema.json"), "--user-config false --global-config false"
            ]);

            expect(response.stderr.toString()).toEqual("");
            expect(response.status).toEqual(0);

            expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"),
                path.join(__dirname, "__resources__", "test.config.good.with.schema.json"));
            expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"),
                path.join(__dirname, "__resources__", "test.schema.good.json"));
            const lastMtimeConfig = fs.statSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json")).mtime;
            const lastMtimeSchema = fs.statSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json")).mtime;

            response = runCliScript(path.join(__dirname, "/__scripts__/import_config_no_mkdir.sh"), TEST_ENVIRONMENT.workingDir, [
                path.join(__dirname, "__resources__", "test.config.good.modified.with.schema.json"), "--user-config false --global-config false --ow"
            ]);

            expect(response.stderr.toString()).toEqual("");
            expect(response.status).toEqual(0);

            expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"),
                path.join(__dirname, "__resources__", "test.config.good.modified.with.schema.json"));
            expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.modified.json"),
                path.join(__dirname, "__resources__", "test.schema.good.modified.json"));
            const mtimeConfig = fs.statSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json")).mtime;
            expect(mtimeConfig.getTime()).toBeGreaterThan(lastMtimeConfig.getTime());
            const mtimeSchema = fs.statSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.modified.json")).mtime;
            expect(mtimeSchema.getTime()).toBeGreaterThan(lastMtimeSchema.getTime());
        });

        describe("from the web", () => {

            it("should successfully import a config from a URL", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    localhostUrl + "/test.config.good.without.schema.json", "--user-config false --global-config false"
                ]);

                expect(response.stderr.toString()).toEqual("");
                expect(response.status).toEqual(0);

                expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"),
                    path.join(__dirname, "__resources__", "test.config.good.without.schema.json"));
                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"))).toEqual(false);
            });

            it("should successfully import a config and schema from a URL", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    localhostUrl + "/test.config.good.with.schema.json", "--user-config false --global-config false"
                ]);
                expect(response.stderr.toString()).toEqual("");
                expect(response.status).toEqual(0);

                expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"),
                    path.join(__dirname, "__resources__", "test.config.good.with.schema.json"));
                expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"),
                    path.join(__dirname, "__resources__", "test.schema.good.json"));
            });
        });

        describe("from the disk", () => {

            it("should successfully import a config from a file", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    path.join(__dirname, "__resources__", "test.config.good.without.schema.json"), "--user-config false --global-config false"
                ]);

                expect(response.stderr.toString()).toEqual("");
                expect(response.status).toEqual(0);

                expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"),
                    path.join(__dirname, "__resources__", "test.config.good.without.schema.json"));
                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"))).toEqual(false);
            });

            it("should successfully import a config and schema from a file", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    path.join(__dirname, "__resources__", "test.config.good.with.schema.json"), "--user-config false --global-config false"
                ]);

                expect(response.stderr.toString()).toEqual("");
                expect(response.status).toEqual(0);

                expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"),
                    path.join(__dirname, "__resources__", "test.config.good.with.schema.json"));
                expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"),
                    path.join(__dirname, "__resources__", "test.schema.good.json"));
            });
        });
    });

    describe("failure scenarios", () => {
        it("should fail to import a schema and config if they already exist", () => {
            let response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                path.join(__dirname, "__resources__", "test.config.good.with.schema.json"), "--user-config false --global-config false"
            ]);

            expect(response.stderr.toString()).toEqual("");
            expect(response.status).toEqual(0);

            expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"),
                path.join(__dirname, "__resources__", "test.config.good.with.schema.json"));
            expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"),
                path.join(__dirname, "__resources__", "test.schema.good.json"));
            const lastMtimeConfig = fs.statSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json")).mtime;
            const lastMtimeSchema = fs.statSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json")).mtime;

            response = runCliScript(path.join(__dirname, "/__scripts__/import_config_no_mkdir.sh"), TEST_ENVIRONMENT.workingDir, [
                path.join(__dirname, "__resources__", "test.config.good.modified.with.schema.json"), "--user-config false --global-config false"
            ]);

            expect(response.stderr.toString()).toEqual("");
            expect(response.stdout.toString()).toContain("Skipping import");
            expect(response.status).toEqual(0);

            const mtimeConfig = fs.statSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json")).mtime;
            expect(mtimeConfig.getTime()).toBe(lastMtimeConfig.getTime());
            const mtimeSchema = fs.statSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json")).mtime;
            expect(mtimeSchema.getTime()).toBe(lastMtimeSchema.getTime());
        });

        describe("from the web", () => {

            it("should fail to import a config from a bad URL", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    localhostUrl + "/test.config.does.not.exist.json", "--user-config false --global-config false"
                ]);

                expect(response.stdout.toString()).toEqual("");
                expect(response.stderr.toString()).toContain("Rest API failure with HTTP(S) status");
                expect(response.status).toEqual(1);

                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"))).toEqual(false);
                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"))).toEqual(false);
            });

            it("should fail to import a schema from a bad URL", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    localhostUrl + "/test.config.bad.with.schema.json", "--user-config false --global-config false"
                ]);

                expect(response.stderr.toString()).toContain("Failed to download schema");
                expect(response.status).toEqual(0);

                expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"),
                    path.join(__dirname, "__resources__", "test.config.bad.with.schema.json"));
                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"))).toEqual(false);
            });

            it("should fail to import a config that is invalid JSON from a URL", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    localhostUrl + "/test.config.bad.json", "--user-config false --global-config false"
                ]);

                expect(response.stdout.toString()).toEqual("");
                expect(response.stderr.toString()).toContain("Unexpected end of JSON input");
                expect(response.status).toEqual(1);

                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"))).toEqual(false);
                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"))).toEqual(false);
            });

            it("should fail to import a schema if it is defined with a URL", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    localhostUrl + "/test.config.good.with.http.schema.json", "--user-config false --global-config false"
                ]);

                expect(response.stderr.toString()).toEqual("");
                expect(response.status).toEqual(0);

                expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"),
                    path.join(__dirname, "__resources__", "test.config.good.with.http.schema.json"));
                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"))).toEqual(false);
            });
        });

        describe("from the disk", () => {
            it("should fail to import a config from a bad path", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    path.join(__dirname, "__resources__", "__fake__", "test.config.good.with.schema.json"),
                    "--user-config false --global-config false"
                ]);

                expect(response.stdout.toString()).toEqual("");
                expect(response.stderr.toString()).toContain("no such file or directory");
                expect(response.status).toEqual(1);

                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"))).toEqual(false);
                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"))).toEqual(false);
            });

            it("should fail to import a schema from a bad path", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    path.join(__dirname, "__resources__", "test.config.bad.with.schema.json"),
                    "--user-config false --global-config false"
                ]);

                expect(response.stderr.toString()).toContain("Failed to download schema");
                expect(response.status).toEqual(0);

                expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"),
                    path.join(__dirname, "__resources__", "test.config.bad.with.schema.json"));
                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"))).toEqual(false);
            });

            it("should fail to import a config that is invalid JSON from a path", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    path.join(__dirname, "__resources__", "test.config.bad.json"),
                    "--user-config false --global-config false"
                ]);

                expect(response.stdout.toString()).toEqual("");
                expect(response.stderr.toString()).toContain("Unexpected end of JSON input");
                expect(response.status).toEqual(1);

                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"))).toEqual(false);
                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"))).toEqual(false);
            });

            it("should fail to import a schema if it is defined with an absolute path", () => {
                const response = runCliScript(path.join(__dirname, "/__scripts__/import_config.sh"), TEST_ENVIRONMENT.workingDir, [
                    path.join(__dirname, "__resources__", "test.config.good.with.file.schema.json"),
                    "--user-config false --global-config false"
                ]);

                expect(response.stderr.toString()).toEqual("");
                expect(response.status).toEqual(0);

                expectFilesAreEqual(path.join(TEST_ENVIRONMENT.workingDir, "test", "imperative-test-cli.config.json"),
                    path.join(__dirname, "__resources__", "test.config.good.with.file.schema.json"));
                expect(fs.existsSync(path.join(TEST_ENVIRONMENT.workingDir, "test", "test.schema.good.json"))).toEqual(false);
            });
        });
    });
});
