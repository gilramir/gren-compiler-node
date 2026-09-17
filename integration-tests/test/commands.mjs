import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import * as fsProm from "node:fs/promises";
import { describe, it } from "node:test";
import * as childProc from "node:child_process";
import { runner } from "clet";

const rootDir = path.resolve();
const packageDir = path.resolve("..");
const appDir = path.resolve("bin");
const homeDir = os.homedir();

describe("compiler-node", () => {
  describe("finding geng.toml", () => {
    it("Finds correct geng.toml path", () => {
      return runner()
        .cwd(rootDir)
        .fork("bin/app", ["find geng.toml"], {})
        .stdout(path.join(rootDir, "geng.toml"));
    });

    it("Finds correct geng.toml path from sub-folder", () => {
      return runner()
        .cwd(appDir)
        .fork("app", ["find geng.toml"], {})
        .stdout(path.join(rootDir, "geng.toml"));
    });

    it("Outputs error message if geng.toml couldn't be found", () => {
      return runner()
        .cwd(homeDir)
        .fork(path.join(appDir, "app"), ["find geng.toml"], {})
        .stdout("ENOENT");
    });
  });

  // Node has no TOML reader, and these manifests are written one entry to a
  // line, so the expectation is read from the file with a pattern per line.
  const expectedOf = (file) => {
    const text = fs.readFileSync(file, "utf-8");
    const expected = { dependencies: {}, sources: [] };
    let table = "";
    for (const line of text.split("\n")) {
      const header = line.match(/^\[([a-z.]+)\]$/);
      const entry = line.match(/^"?([^"=]+?)"? = (.*)$/);
      if (header) {
        table = header[1];
        if (table === "application" || table === "package") expected.type = table;
      } else if (entry && table === "package" && (entry[1] === "name" || entry[1] === "version")) {
        expected[entry[1]] = JSON.parse(entry[2]);
      } else if (entry && table === "dependencies") {
        expected.dependencies[entry[1]] = JSON.parse(entry[2]);
      } else if (entry && table === "sources") {
        expected.sources.push(entry[1]);
      }
    }
    expected.sources.sort();
    return expected;
  };

  describe("parsing geng.toml", () => {
    it("Correctly parses the integration test project's geng.toml", () => {
      const expected = expectedOf(path.join(rootDir, "geng.toml"));
      return runner()
        .cwd(rootDir)
        .fork("bin/app", ["parse geng.toml"], {})
        .expect(({ assert, result }) => {
          assert.deepStrictEqual(JSON.parse(result.stdout), expected);
        });
    });

    it("Correctly parses the package's geng.toml", () => {
      const expected = expectedOf(path.join(packageDir, "geng.toml"));
      return runner()
        .cwd(packageDir)
        .fork("integration-tests/bin/app", ["parse geng.toml"], {})
        .expect(({ assert, result }) => {
          assert.deepStrictEqual(JSON.parse(result.stdout), expected);
        });
    });
  });

  describe("file lock", () => {
    it("Aquires and releases lock", () => {
      return runner()
        .cwd(rootDir)
        .fork("bin/app", ["lock", "50"], {})
        .stdout("Lock Aquired")
        .stdout("Lock Released")
        .expect(({ assert }) => {
          assert.equal(false, fs.existsSync(".lock"));
        });
    });

    it("Blocks others from aquiring lock", async () => {
      const proc = childProc.spawn(
        path.join(rootDir, "bin/app"),
        ["lock", "1000"],
        {
          cwd: rootDir,
        },
      );

      await new Promise((r) => setTimeout(r, 50));

      return runner()
        .cwd(rootDir)
        .fork("bin/app", ["lock", "50"], {})
        .stdout("Already Locked")
        .expect(async () => {
          proc.kill();
          await fsProm.rm(".lock", { recursive: true });
        });
    });

    // A lock is stale once nobody has touched it for five seconds, so a
    // holder past that must keep touching it.
    it("Keeps a lock held past the staleness limit", async () => {
      const proc = childProc.spawn(
        path.join(rootDir, "bin/app"),
        ["lock", "7000"],
        {
          cwd: rootDir,
        },
      );

      await new Promise((r) => setTimeout(r, 6000));

      return runner()
        .cwd(rootDir)
        .fork("bin/app", ["lock", "50"], {})
        .stdout("Already Locked")
        .expect(async () => {
          proc.kill();
          await fsProm.rm(".lock", { recursive: true });
        });
    });

    it("Ignores stale locks", async () => {
      const lockPath = path.join(rootDir, ".lock");
      await fsProm.mkdir(lockPath);
      await fsProm.utimes(lockPath, 0, 0);

      return runner()
        .cwd(rootDir)
        .fork("bin/app", ["lock", "50"], {})
        .stdout("Lock Aquired")
        .stdout("Lock Released");
    });

    it("Can be set to perform 3 retries", async () => {
      const proc = childProc.spawn(
        path.join(rootDir, "bin/app"),
        ["lock", "1000"],
        {
          cwd: rootDir,
        },
      );

      await new Promise((r) => setTimeout(r, 50));

      return runner()
        .cwd(rootDir)
        .fork("bin/app", ["lock", "50", "500"], {})
        .stdout("Lock Aquired")
        .stdout("Lock Released")
        .expect(async () => {
          proc.kill();
          try {
            await fsProm.rm(".lock", { recursive: true });
          } catch (e) {
            // .lock probably didn't exist, which means the application cleaned it up
          }
        });
    });
  });
});
