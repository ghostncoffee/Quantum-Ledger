const WATCHER_VERSION = '0.1.7';
const KNOWN_CHANNELS = new Set(['LIVE', 'PTU', 'EPTU', 'HOTFIX', 'TECH-PREVIEW']);
const BLUEPRINT_CORRELATION_WINDOW_SEC = 5.0;

export interface MissionEntry {
  debugName: string;
  generator: string;
  contractDefinitionId: string | null;
}

export interface ActiveMission {
  guid: string;
  debugName: string;
  generator: string;
  startTs: number;
  contractDefinitionId: string | null;
}

export interface MissionLifecycleEvent {
  trigger: 'accept' | 'complete';
  guid: string;
  debugName: string;
  ts: number;
  contractDefinitionId: string | null;
}

export interface ScanResult {
  payload: {
    exportSchemaVersion: 1;
    watcherVersion: string;
    channel: string;
    exportedAt: string;
    sourceLogs: string[];
    missions: Array<Record<string, unknown>>;
    blueprints: Array<Record<string, unknown>>;
  };
  missionsCount: number;
  blueprintsCount: number;
  duplicateMissions: number;
}

function parseLogTimestamp(line: string): number {
  const match = /^<([0-9T:\-.Z]+)>/.exec(line);
  if (!match) {
    return 0;
  }
  const raw = match[1].replace('Z', '+00:00');
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms / 1000;
}

function getChannelFromPath(path: string): string | null {
  const segments = path.replace(/\\/g, '/').split('/').filter(Boolean);
  for (const segment of segments) {
    const name = segment.toUpperCase();
    if (KNOWN_CHANNELS.has(name)) {
      return name;
    }
  }
  return null;
}

class WatcherState {
  guidMap = new Map<string, MissionEntry>();
  active = new Map<string, ActiveMission>();
  recentLifecycle: MissionLifecycleEvent[] = [];

  recordMarker(guid: string, generator: string, contract: string, contractDefinitionId: string | null) {
    if (!this.guidMap.has(guid)) {
      this.guidMap.set(guid, { debugName: contract, generator, contractDefinitionId });
    }
  }

  recordAccepted(guid: string, ts: number) {
    const entry = this.guidMap.get(guid);
    if (!entry) {
      return null;
    }
    const active: ActiveMission = {
      guid,
      debugName: entry.debugName,
      generator: entry.generator,
      startTs: ts,
      contractDefinitionId: entry.contractDefinitionId,
    };
    this.active.set(guid, active);
    this.recentLifecycle.push({
      trigger: 'accept',
      guid,
      debugName: entry.debugName,
      ts,
      contractDefinitionId: entry.contractDefinitionId,
    });
    if (this.recentLifecycle.length > 32) {
      this.recentLifecycle.shift();
    }
    return active;
  }

  recordEnd(guid: string, completion: string, ts: number) {
    const active = this.active.get(guid) ?? null;
    if (active) {
      this.active.delete(guid);
    }
    const entry = this.guidMap.get(guid);
    if (completion === 'Complete') {
      const debugName = active?.debugName ?? entry?.debugName ?? '?';
      const contractDefinitionId = active?.contractDefinitionId ?? entry?.contractDefinitionId ?? null;
      this.recentLifecycle.push({
        trigger: 'complete',
        guid,
        debugName,
        ts,
        contractDefinitionId,
      });
      if (this.recentLifecycle.length > 32) {
        this.recentLifecycle.shift();
      }
    }
    return active;
  }

  correlateBlueprint(ts: number) {
    let best: MissionLifecycleEvent | null = null;
    let bestDelta = BLUEPRINT_CORRELATION_WINDOW_SEC + 1.0;
    for (const event of this.recentLifecycle) {
      const delta = ts - event.ts;
      if (delta >= 0 && delta <= BLUEPRINT_CORRELATION_WINDOW_SEC && delta < bestDelta) {
        best = event;
        bestDelta = delta;
      }
    }
    return best;
  }
}

function scanLogFile(text: string, state: WatcherState) {
  const missions: Array<Record<string, unknown>> = [];
  const blueprints: Array<Record<string, unknown>> = [];

  const markerRe = /CreateMarker.*missionId \[([^\]]+)\].*generator name \[([^\]]+)\].*contract \[([^\]]+)\]/;
  const markerDefIdRe = /contractDefinitionId\[([^\]]+)\]/;
  const acceptedRe = /Added notification "Contract Accepted:.*?MissionId: \[([^\]]+)\]/;
  const endRe = /<EndMission>.*MissionId\[([^\]]+)\].*CompletionType\[(\w+)\].*Reason\[([^\]]+)\]/;
  const blueprintRe = /Added notification "Received Blueprint: ([^:]+):/;

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine) {
      continue;
    }
    const ts = parseLogTimestamp(rawLine);

    const marker = markerRe.exec(rawLine);
    if (marker) {
      const defIdMatch = markerDefIdRe.exec(rawLine);
      state.recordMarker(marker[1], marker[2], marker[3], defIdMatch ? defIdMatch[1] : null);
      continue;
    }

    const accepted = acceptedRe.exec(rawLine);
    if (accepted) {
      state.recordAccepted(accepted[1], ts);
      continue;
    }

    const end = endRe.exec(rawLine);
    if (end) {
      const guid = end[1];
      const completion = end[2];
      const reason = end[3];
      const active = state.recordEnd(guid, completion, ts);
      if (completion === 'Complete' && active) {
        missions.push({
          guid,
          debugName: active.debugName,
          generator: active.generator,
          contractDefinitionId: active.contractDefinitionId,
          startTs: active.startTs,
          endTs: ts,
          durationSec: Math.round((ts - active.startTs) * 1000) / 1000,
          reason,
        });
      }
      continue;
    }

    const blueprint = blueprintRe.exec(rawLine);
    if (blueprint) {
      const productName = blueprint[1].trim();
      const corr = state.correlateBlueprint(ts);
      blueprints.push({
        productName,
        ts,
        missionGuid: corr?.guid ?? null,
        missionDebugName: corr?.debugName ?? null,
        missionContractDefinitionId: corr?.contractDefinitionId ?? null,
        missionTrigger: corr?.trigger ?? null,
      });
      continue;
    }
  }

  return { missions, blueprints };
}

export async function scanFiles(files: File[]): Promise<ScanResult> {
  const filesToParse = files.filter(file => file.name.toLowerCase().endsWith('.log'));
  if (filesToParse.length === 0) {
    throw new Error('No .log files selected.');
  }

  const sourceLogs: string[] = [];
  const channelNames = new Set<string>();
  const allMissions: Array<Record<string, unknown>> = [];
  const allBlueprints: Array<Record<string, unknown>> = [];
  const seenGuids = new Set<string>();

  for (const file of filesToParse) {
    const text = await file.text();
    const state = new WatcherState();
    const { missions, blueprints } = scanLogFile(text, state);
    sourceLogs.push((file as any).webkitRelativePath || file.name);
    allMissions.push(...missions);
    allBlueprints.push(...blueprints);
    const channel = getChannelFromPath((file as any).webkitRelativePath || file.name);
    if (channel) {
      channelNames.add(channel);
    }
  }

  const dedupedMissions: Array<Record<string, unknown>> = [];
  for (const mission of allMissions) {
    const guid = String(mission.guid ?? '');
    if (seenGuids.has(guid)) {
      continue;
    }
    seenGuids.add(guid);
    dedupedMissions.push(mission);
  }

  return {
    payload: {
      exportSchemaVersion: 1,
      watcherVersion: WATCHER_VERSION,
      channel: channelNames.size === 1 ? Array.from(channelNames)[0] : 'UNKNOWN',
      exportedAt: new Date().toISOString(),
      sourceLogs,
      missions: dedupedMissions,
      blueprints: allBlueprints,
    },
    missionsCount: dedupedMissions.length,
    blueprintsCount: allBlueprints.length,
    duplicateMissions: allMissions.length - dedupedMissions.length,
  };
}
