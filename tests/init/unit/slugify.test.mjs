import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, titleCase } from '../../../scripts/init/slugify.mjs';

test('slugify lowercases and dashes', () => {
  assert.equal(slugify('My Shop'), 'my-shop');
  assert.equal(slugify('Hello_World'), 'hello-world');
  assert.equal(slugify('  Spaces  '), 'spaces');
});

test('slugify drops disallowed chars', () => {
  assert.equal(slugify('café!'), 'caf');
  assert.equal(slugify('site/v1.0'), 'site-v1-0');
});

test('slugify collapses multiple dashes', () => {
  assert.equal(slugify('a--b---c'), 'a-b-c');
  assert.equal(slugify('--foo--'), 'foo');
});

test('titleCase splits on hyphens', () => {
  assert.equal(titleCase('my-shop'), 'My Shop');
  assert.equal(titleCase('hello-world-site'), 'Hello World Site');
});
