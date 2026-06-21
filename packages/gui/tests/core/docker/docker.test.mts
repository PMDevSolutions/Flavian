import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseComposePs } from '../../../src/core/docker/docker-status';
import { dockerCommandSpec, isDockerCommand } from '../../../src/core/docker/docker-commands';
import { CommandBuilder } from '../../../src/core/shell/command-builder';
import type { ShellResolver } from '../../../src/core/shell/shell-resolver';

const fakeShell: ShellResolver = {
  resolveBash: async () => 'bash',
  resolveTool: async () => null,
};

test('parseComposePs handles a JSON array (Publishers → ports)', () => {
  const raw = JSON.stringify([
    {
      Name: 'flavian-wp',
      Service: 'wordpress',
      State: 'running',
      Status: 'Up 2 minutes',
      Publishers: [{ PublishedPort: 8080, TargetPort: 80, Protocol: 'tcp' }],
    },
    { Name: 'flavian-db', Service: 'db', State: 'running', Status: 'Up 2 minutes (healthy)' },
  ]);
  const services = parseComposePs(raw);
  assert.equal(services.length, 2);
  assert.equal(services[0].service, 'wordpress');
  assert.equal(services[0].state, 'running');
  assert.match(services[0].ports, /8080->80/);
  assert.equal(services[1].ports, '');
});

test('parseComposePs handles newline-delimited JSON (Ports string)', () => {
  const raw = [
    JSON.stringify({
      Name: 'a',
      Service: 'wordpress',
      State: 'running',
      Status: 'Up',
      Ports: '0.0.0.0:8080->80/tcp',
    }),
    JSON.stringify({ Name: 'b', Service: 'db', State: 'exited', Status: 'Exited (0)' }),
  ].join('\n');
  const services = parseComposePs(raw);
  assert.equal(services.length, 2);
  assert.equal(services[0].ports, '0.0.0.0:8080->80/tcp');
  assert.equal(services[1].state, 'exited');
});

test('parseComposePs returns [] for empty or non-JSON input', () => {
  assert.deepEqual(parseComposePs(''), []);
  assert.deepEqual(parseComposePs('not json'), []);
});

test('dockerCommandSpec builds a bash wordpress-local.sh invocation', async () => {
  const spec = await dockerCommandSpec(new CommandBuilder(fakeShell), '/repo', 'start');
  assert.equal(spec.command, 'bash');
  assert.ok(spec.args[0].endsWith('wordpress-local.sh'));
  assert.equal(spec.args[1], 'start');
});

test('dockerCommandSpec forwards an argument (activate-theme)', async () => {
  const spec = await dockerCommandSpec(new CommandBuilder(fakeShell), '/repo', 'activate-theme', 'my-theme');
  assert.deepEqual(spec.args.slice(1), ['activate-theme', 'my-theme']);
});

test('isDockerCommand validates the command set', () => {
  assert.ok(isDockerCommand('start'));
  assert.ok(isDockerCommand('activate-theme'));
  assert.ok(!isDockerCommand('rm -rf'));
});
