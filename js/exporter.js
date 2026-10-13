/**
 * Exportador de Sesiones a Formato TCX (Training Center XML) para Strava y Garmin
 */

export function exportToTCX({ title, startTime, totalSeconds, steps, heartRateSamples = [] }) {
  const startDate = new Date(startTime);
  const isoStart = startDate.toISOString();

  let trackpointsXml = '';
  let currentTime = new Date(startTime);

  // Si tenemos muestras reales de frecuencia cardíaca BLE
  if (heartRateSamples && heartRateSamples.length > 0) {
    heartRateSamples.forEach(sample => {
      const sampleTime = new Date(sample.timestamp).toISOString();
      trackpointsXml += `
        <Trackpoint>
          <Time>${sampleTime}</Time>
          <HeartRateBpm>
            <Value>${sample.bpm}</Value>
          </HeartRateBpm>
          <SensorState>Present</SensorState>
        </Trackpoint>`;
    });
  } else {
    // Generar trackpoints sintéticos a partir de las fases de la rutina
    steps.forEach(step => {
      const stepDuration = step.t;
      const intervalSec = Math.max(5, Math.floor(stepDuration / 5)); // Cada pocos segundos
      const stepBpm = step.zone ? Math.min(190, 95 + step.zone * 18) : 120;

      for (let sec = 0; sec < stepDuration; sec += intervalSec) {
        currentTime = new Date(currentTime.getTime() + intervalSec * 1000);
        trackpointsXml += `
        <Trackpoint>
          <Time>${currentTime.toISOString()}</Time>
          <HeartRateBpm>
            <Value>${stepBpm}</Value>
          </HeartRateBpm>
          <SensorState>Absent</SensorState>
        </Trackpoint>`;
      }
    });
  }

  const tcxContent = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="Biking">
      <Id>${isoStart}</Id>
      <Lap StartTime="${isoStart}">
        <TotalTimeSeconds>${totalSeconds}</TotalTimeSeconds>
        <DistanceMeters>0.0</DistanceMeters>
        <Calories>${Math.round(totalSeconds * 0.15)}</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
          ${trackpointsXml}
        </Track>
        <Notes>Pain Cave Pro - ${title}</Notes>
      </Lap>
    </Activity>
  </Activities>
  <Author xsi:type="Application_t">
    <Name>Pain Cave Pro</Name>
    <Build>
      <Version>
        <VersionMajor>2</VersionMajor>
        <VersionMinor>0</VersionMinor>
      </Version>
    </Build>
    <LangID>es</LangID>
  </Author>
</TrainingCenterDatabase>`;

  const blob = new Blob([tcxContent], { type: 'application/vnd.garmin.tcx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `paincave-${startDate.toISOString().split('T')[0]}-${startDate.getHours()}${startDate.getMinutes()}.tcx`;
  a.click();
  URL.revokeObjectURL(url);
}
