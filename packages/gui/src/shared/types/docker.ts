/** Docker WordPress lifecycle, mapped 1:1 to wordpress-local.sh subcommands. */
export type DockerCommand =
  | 'build'
  | 'start'
  | 'stop'
  | 'restart'
  | 'install'
  | 'logs'
  | 'list-themes'
  | 'activate-theme';

/** A row of `docker compose ps`, normalized for display. */
export interface DockerService {
  name: string;
  service: string;
  state: string;
  status: string;
  ports: string;
}
