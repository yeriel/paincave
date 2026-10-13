/**
 * Manejador de Web Bluetooth para Frecuencia Cardíaca (HRM BLE)
 */

class BluetoothManager {
  constructor() {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.isConnected = false;
    this.currentBpm = null;
    this.samples = []; // Muestras registradas para análisis post-entreno
    this.onBpmUpdate = null;
    this.onConnectionChange = null;
  }

  isSupported() {
    return 'bluetooth' in navigator;
  }

  async connect() {
    if (!this.isSupported()) {
      throw new Error("Web Bluetooth no está soportado en este navegador. Utiliza Chrome o Edge.");
    }

    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['heart_rate'] }]
    });

    this.device.addEventListener('gattserverdisconnected', () => this.handleDisconnected());
    this.server = await this.device.gatt.connect();
    const service = await this.server.getPrimaryService('heart_rate');
    this.characteristic = await service.getCharacteristic('heart_rate_measurement');
    await this.characteristic.startNotifications();
    this.characteristic.addEventListener('characteristicvaluechanged', (e) => this.handleMeasurement(e));

    this.isConnected = true;
    if (this.onConnectionChange) this.onConnectionChange(true);
    return true;
  }

  disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.handleDisconnected();
  }

  handleDisconnected() {
    this.isConnected = false;
    this.currentBpm = null;
    this.device = null;
    this.server = null;
    this.characteristic = null;
    if (this.onConnectionChange) this.onConnectionChange(false);
  }

  handleMeasurement(event) {
    const val = event.target.value;
    const bpm = (val.getUint8(0) & 0x01) === 0 ? val.getUint8(1) : val.getUint16(1, true);
    this.currentBpm = bpm;
    this.samples.push({ timestamp: Date.now(), bpm });

    if (this.onBpmUpdate) {
      this.onBpmUpdate(bpm);
    }
  }

  clearSessionSamples() {
    this.samples = [];
  }

  getHeartRateStats() {
    if (this.samples.length === 0) {
      return { avg: null, max: null, samplesCount: 0 };
    }
    const bpms = this.samples.map(s => s.bpm);
    const sum = bpms.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round(sum / bpms.length),
      max: Math.max(...bpms),
      samplesCount: bpms.length
    };
  }
}

export const bluetoothManager = new BluetoothManager();
