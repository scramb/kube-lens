import { describe, expect, it } from 'vitest';
import {
  buildCrdNav,
  normalizeCRDGroupingSettings,
  productForGroup,
  sanitizeCustomSvg,
  sanitizeRuleId,
  validateCRDGroupRule,
} from './resourceCatalog';
import { APIResource } from './types';

function res(group: string, kind: string, name = kind.toLowerCase() + 's'): APIResource {
  return { group, version: 'v1', kind, name, namespaced: true };
}

describe('productForGroup / pattern matching', () => {
  it('maps default rules by suffix wildcard', () => {
    expect(productForGroup('kustomize.toolkit.fluxcd.io')).toBe('Flux');
    expect(productForGroup('source.toolkit.fluxcd.io')).toBe('Flux');
    expect(productForGroup('monitoring.coreos.com')).toBe('Prometheus Operator');
    expect(productForGroup('networking.istio.io')).toBe('Istio');
  });

  it('falls back to the raw API group when nothing matches', () => {
    expect(productForGroup('acme.example.com')).toBe('acme.example.com');
  });

  it('does not match the bare domain with a *. suffix pattern', () => {
    // '*.cert-manager.io' must not match 'cert-manager.io' itself;
    // the default rule matches it via the exact pattern instead.
    expect(productForGroup('cert-manager.io')).toBe('Cert-Manager');
    expect(productForGroup('fluxcd.io')).toBe('fluxcd.io');
  });

  it('prefers user rules over default rules', () => {
    const settings = normalizeCRDGroupingSettings({
      rules: [{ id: 'my-flux', label: 'My Flux', patterns: ['*.fluxcd.io'], icon: '', enabled: true }],
    });
    expect(productForGroup('kustomize.toolkit.fluxcd.io', settings)).toBe('My Flux');
  });

  it('first matching user rule wins', () => {
    const settings = normalizeCRDGroupingSettings({
      rules: [
        { id: 'first', label: 'First', patterns: ['*.example.com'], icon: '', enabled: true },
        { id: 'second', label: 'Second', patterns: ['crd.example.com'], icon: '', enabled: true },
      ],
    });
    expect(productForGroup('crd.example.com', settings)).toBe('First');
  });

  it('ignores disabled rules', () => {
    const settings = normalizeCRDGroupingSettings({
      rules: [{ id: 'off', label: 'Off', patterns: ['*.fluxcd.io'], icon: '', enabled: false }],
    });
    expect(productForGroup('kustomize.toolkit.fluxcd.io', settings)).toBe('Flux');
  });

  it('supports infix wildcards', () => {
    const settings = normalizeCRDGroupingSettings({
      rules: [{ id: 'infix', label: 'Infix', patterns: ['crd.*.example.com'], icon: '', enabled: true }],
    });
    expect(productForGroup('crd.eu.example.com', settings)).toBe('Infix');
    expect(productForGroup('crd.example.com', settings)).toBe('crd.example.com');
  });
});

describe('buildCrdNav collision handling', () => {
  it('adds the group suffix only on real kind collisions within a section', () => {
    const sections = buildCrdNav([
      res('kustomize.toolkit.fluxcd.io', 'Kustomization'),
      res('source.toolkit.fluxcd.io', 'GitRepository', 'gitrepositories'),
      // Same kind name from two groups that land in the same (Flux) section:
      res('image.toolkit.fluxcd.io', 'Alert', 'alerts'),
      res('notification.toolkit.fluxcd.io', 'Alert', 'alerts'),
    ]);

    const flux = sections.find((s) => s.label === 'Flux');
    expect(flux).toBeDefined();
    const labels = flux!.items.map((i) => i.label);
    expect(labels).toContain('Kustomization');
    expect(labels).toContain('GitRepository');
    expect(labels).toContain('Alert (image.toolkit.fluxcd.io)');
    expect(labels).toContain('Alert (notification.toolkit.fluxcd.io)');
  });

  it('groups unmatched CRDs under their raw API group', () => {
    const sections = buildCrdNav([res('acme.example.com', 'Widget')]);
    expect(sections.map((s) => s.label)).toContain('acme.example.com');
  });
});

describe('normalize / validate rules', () => {
  it('sanitizes rule ids', () => {
    expect(sanitizeRuleId('My Rule!')).toBe('my-rule');
    expect(sanitizeRuleId('  ')).toBe('custom-group');
  });

  it('normalizes missing fields with defaults', () => {
    const settings = normalizeCRDGroupingSettings({
      rules: [{ id: '', label: '', patterns: [' a.io ', ''], icon: '', enabled: true }],
    });
    expect(settings.rules[0].patterns).toEqual(['a.io']);
    expect(settings.rules[0].enabled).toBe(true);
    expect(settings.rules[0].label).toBe('Custom Group');
  });

  it('validates label, patterns and whitespace', () => {
    expect(validateCRDGroupRule({ id: 'x', label: '', patterns: [], icon: '', enabled: true })).toEqual([
      'Label is required.',
      'At least one pattern is required.',
    ]);
    const errors = validateCRDGroupRule({ id: 'x', label: 'X', patterns: ['a b.io'], icon: '', enabled: true });
    expect(errors.some((e) => e.includes('whitespace'))).toBe(true);
  });
});

describe('sanitizeCustomSvg', () => {
  it('accepts a plain svg', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';
    expect(sanitizeCustomSvg(svg)).toBe(svg);
  });

  it('rejects scripts, event handlers and external references', () => {
    expect(sanitizeCustomSvg('<svg><script>alert(1)</script></svg>')).toBeNull();
    expect(sanitizeCustomSvg('<svg onload="x()"><path/></svg>')).toBeNull();
    expect(sanitizeCustomSvg('<svg><use href="https://evil.example/x.svg#a"/></svg>')).toBeNull();
    expect(sanitizeCustomSvg('<svg><foreignObject/></svg>')).toBeNull();
    expect(sanitizeCustomSvg('<div>not svg</div>')).toBeNull();
  });

  it('rejects oversized icons', () => {
    const big = `<svg>${'x'.repeat(9000)}</svg>`;
    expect(sanitizeCustomSvg(big)).toBeNull();
  });
});
