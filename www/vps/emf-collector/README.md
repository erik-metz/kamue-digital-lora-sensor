# EMF collector

Collects Bundesnetzagentur certified radio sites in the configured Ried bounding box daily.
Stores sites as `radio_tower` entities and coordinates, antenna counts, heights and safety distances in the measurement core.
The API publishes these through `/api/v1/infrastructure/emf`, `/api/v1/collected/infrastructure/emf` and the `emf` GeoJSON layer in `/api/v1/map/collected-layers`.
The frontend displays the layer from zoom 10.

## VPS repair on 2026-10-05

The configured collector had never been created and its image was missing from CI.
Built the collector on the VPS and started it with `docker compose up -d --no-deps emf-collector`.
First import: 425 sites and 1,916 measurement writes. Daily interval: 86,400 seconds.

The API lacked EMF map publication and routed the infrastructure URL to a missing dataset.
The previously unused EMF reader also assumed tuple rows instead of production dict rows.
All three issues are corrected in the repository.

The running VPS API preserves its existing code plus the EMF fix in `/root/emf-api-fix/`.
`/root/docker-compose.override.yml` mounts the two patched endpoint files read-only into the API container.
Original collected endpoint backup: `/tmp/collected-before-emf.py`; original infrastructure backup: `/tmp/infrastructure-live.py`.
Once a repository-built API image containing these changes is deployed, remove those two mounts and the override file, then recreate the API container.
Do this during that deployment so the temporary mounts do not mask future endpoint changes.

Verification: 13 API unit tests, public backend and frontend proxy both return 425 sites, and live browser renders Funkanlage STOB markers and clusters.
