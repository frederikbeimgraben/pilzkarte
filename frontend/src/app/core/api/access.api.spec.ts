import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CATALOGUE, ADVISOR_ROLE, PEOPLE, ROLES } from '../../testing/access-fixture';
import { AccessApi } from './access.api';

function build(): { api: AccessApi; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(AccessApi), http: TestBed.inject(HttpTestingController) };
}

describe('AccessApi', () => {
  it('liest die eigenen Rechte und den Katalog', () => {
    const { api, http } = build();

    api.mine().subscribe();
    api.catalogue().subscribe();

    expect(http.expectOne('/api/me/permissions').request.method).toBe('GET');
    http.expectOne('/api/permissions').flush(CATALOGUE);
    http.verify();
  });

  it('legt eine Rolle an, ändert und löscht sie', () => {
    const { api, http } = build();

    api.createRole({ slug: 'berater', name: 'Pilzberater', description: null, permissions: [] }).subscribe();
    http.expectOne({ url: '/api/roles', method: 'POST' }).flush(ADVISOR_ROLE);
    api.patchRole('rolle-berater', { name: 'Beraterin' }).subscribe();
    http.expectOne({ url: '/api/roles/rolle-berater', method: 'PATCH' }).flush(ADVISOR_ROLE);
    api.deleteRole('rolle-berater').subscribe();

    expect(http.expectOne('/api/roles/rolle-berater').request.method).toBe('DELETE');
    http.verify();
  });

  it('lässt die Suche weg, solange niemand etwas eingetippt hat', () => {
    const { api, http } = build();

    api.people('').subscribe();
    http.expectOne('/api/people').flush({ eintraege: PEOPLE, gesamt: 2, limit: 50, offset: 0 });
    api.people('jonas').subscribe();

    expect(http.expectOne('/api/people?q=jonas').request.method).toBe('GET');
    http.verify();
  });

  it('vergibt Rollen mit PUT und kodiert einen sub, der so nicht in eine Adresse gehört', () => {
    const { api, http } = build();

    api.setRoles('sub/eins', [ROLES[0].id]).subscribe();
    const call = http.expectOne('/api/people/sub%2Feins/roles');

    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual({ roles: ['rolle-admin'] });
    call.flush(PEOPLE[0]);
    http.verify();
  });
});
