import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { fetchStatus, fetchSensorHistory, fetchNotifications } from '../services/api';
import DashboardHeader from '../components/DashboardHeader';
import DeviceHeroCard from '../components/DeviceHeroCard';
import SensorGrid from '../components/SensorGrid';
import EnvironmentTrends from '../components/EnvironmentTrends';
import CryPredictionPanel from '../components/CryPredictionPanel';
import ListenButton from '../components/ListenButton';
import ActivityTimeline from '../components/ActivityTimeline';
import CriticalAlerts from '../components/CriticalAlerts';
import DashboardFooter from '../components/DashboardFooter';
import CryAlertDetailModal from '../components/CryAlertDetailModal';
import NurseryCoachFab from '../components/NurseryCoachFab';
import { BABY_AGE_LABELS } from '../constants/userProfile';
import {
  mergeSensorHistory,
  mergeNotifications,
  mergeCryEvents,
  getCsvSensorHistory,
  getCsvNotifications,
  getCsvCryEvents,
  buildAgentContext,
  buildActivityTimelineItems,
} from '../utils/analyticsData';

const POLL_INTERVAL = 5000;

export default function DashboardHome() {
  const navigate = useNavigate();
  const [sessionUser, setSessionUser] = useState(null);
  const [espConnected, setEspConnected] = useState(false);
  const [sensorData, setSensorData] = useState({
    temperature: null,
    humidity: null,
    motion: false,
    light_dark: false,
    timestamp: null,
  });
  const [cryStatus, setCryStatus] = useState({
    cry_detected: false,
    message: 'Waiting for data...',
    timestamp: null,
  });
  const [activeAlert, setActiveAlert] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [mergedSensors, setMergedSensors] = useState([]);
  const [mergedEvents, setMergedEvents] = useState([]);
  const [mergedNotifs, setMergedNotifs] = useState([]);

  const loadAnalyticsMerge = useCallback(async () => {
    try {
      const [histRes, notifRes] = await Promise.all([
        fetchSensorHistory(160).catch(() => ({ data: [] })),
        fetchNotifications(200).catch(() => ({ notifications: [] })),
      ]);
      const mongoS = histRes?.data || [];
      const mongoN = notifRes?.notifications || [];
      const csvS = getCsvSensorHistory();
      const csvN = getCsvNotifications();
      const csvCry = getCsvCryEvents();
      const ms = mergeSensorHistory(mongoS, csvS);
      const mn = mergeNotifications(mongoN, csvN);
      const ev = mergeCryEvents(csvCry, mn, ms);
      setMergedSensors(ms);
      setMergedNotifs(mn);
      setMergedEvents(ev);
    } catch (err) {
      console.error('[analytics merge]', err);
      const csvS = getCsvSensorHistory();
      const csvN = getCsvNotifications();
      const csvCry = getCsvCryEvents();
      const ms = mergeSensorHistory([], csvS);
      const mn = mergeNotifications([], csvN);
      setMergedSensors(ms);
      setMergedNotifs(mn);
      setMergedEvents(mergeCryEvents(csvCry, mn, ms));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadUser = async () => {
      try {
        const raw = localStorage.getItem('cryguard_user');
        if (raw) {
          try {
            setSessionUser(JSON.parse(raw));
          } catch {
            /* ignore */
          }
        }
        const token = localStorage.getItem('cryguard_token');
        if (!token) return;
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const u = await res.json();
        if (cancelled) return;
        localStorage.setItem('cryguard_user', JSON.stringify(u));
        setSessionUser(u);
      } catch {
        /* ignore */
      }
    };
    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadAnalyticsMerge();
    const id = setInterval(loadAnalyticsMerge, 60000);
    return () => clearInterval(id);
  }, [loadAnalyticsMerge]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const status = await fetchStatus();
        setEspConnected(status.esp_connected);
        if (status.sensor_data) setSensorData(status.sensor_data);
        if (status.cry_status) setCryStatus(status.cry_status);
      } catch (err) {
        console.error('[API] Failed to load initial data:', err);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const status = await fetchStatus();
        setEspConnected(status.esp_connected);
        if (status.sensor_data) setSensorData(status.sensor_data);
        if (status.cry_status) setCryStatus(status.cry_status);
      } catch (err) {
        console.error('[API] Polling error:', err);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const agentContext = useMemo(
    () => buildAgentContext(mergedSensors, mergedEvents, mergedNotifs),
    [mergedSensors, mergedEvents, mergedNotifs],
  );
  const timelineItems = useMemo(
    () => buildActivityTimelineItems(mergedSensors, mergedNotifs),
    [mergedSensors, mergedNotifs],
  );

  const handleCryAlert = useCallback((data, notification) => {
    setCryStatus(data);

    const notif = notification || {
      type: 'cry_alert',
      message: data.message || 'Baby is crying!',
      timestamp: data.timestamp || Date.now() / 1000,
      source: data.source || 'unknown',
    };

    setActiveAlert(notif);
    setDetailModalOpen(true);

    if (Notification.permission === 'granted') {
      new Notification('🚨 CryGuard Alert', {
        body: notif.message,
        icon: '/vite.svg',
        tag: 'cry-alert',
        requireInteraction: true,
      });
    }
  }, []);

  const handleWsMessage = useCallback(
    (msg) => {
      switch (msg.type) {
        case 'full_state':
          setEspConnected(msg.esp_connected);
          if (msg.sensor_data) setSensorData(msg.sensor_data);
          if (msg.cry_status) setCryStatus(msg.cry_status);
          break;

        case 'sensor_update':
          setEspConnected(msg.esp_connected ?? true);
          if (msg.data) setSensorData(msg.data);
          break;

        case 'cry_alert':
          if (msg.data) {
            handleCryAlert(msg.data, msg.notification);
          }
          break;

        case 'cry_update':
          if (msg.data) setCryStatus(msg.data);
          break;

        default:
          break;
      }
    },
    [handleCryAlert],
  );

  useWebSocket(handleWsMessage);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="dash-page">
      <DashboardHeader />
      <DeviceHeroCard
        espConnected={espConnected}
        sensorData={sensorData}
        cryStatus={cryStatus}
        onDetailsClick={() => setDetailModalOpen(true)}
        babyName={sessionUser?.babyName}
        babyAgeLabel={sessionUser?.babyAge ? BABY_AGE_LABELS[sessionUser.babyAge] || sessionUser.babyAge : ''}
        babyPhotoUrl={sessionUser?.babyPhotoUrl}
      />
      <SensorGrid sensorData={sensorData} />

      <div className="dash-main-grid">
        <EnvironmentTrends
          series={mergedSensors}
          temperature={sensorData?.temperature}
          humidity={sensorData?.humidity}
        />
        <div className="dash-main-right">
          <CryPredictionPanel notifications={mergedNotifs} />
        </div>
      </div>

      <ListenButton onCryAlert={handleCryAlert} />

      <div className="dash-coach-grid">
        <ActivityTimeline items={timelineItems} />
      </div>

      <div className="dash-post-coach">
        <CriticalAlerts />
      </div>

      <DashboardFooter />

      <NurseryCoachFab agentContext={agentContext} title="Cry Guard Assistant" />

      <CryAlertDetailModal
        open={detailModalOpen || !!activeAlert}
        onClose={() => {
          setDetailModalOpen(false);
          setActiveAlert(null);
        }}
        onAcknowledge={() => navigate('/dashboard/alert-escalation')}
        liveCry={!!activeAlert}
        allowManualSms={!!activeAlert && !!localStorage.getItem('cryguard_token')}
        sessionUser={sessionUser}
        activeAlertMessage={activeAlert?.message || cryStatus?.message || ''}
        cryLabel={cryStatus?.cry_label || activeAlert?.cry_label || ''}
        reason={
          (cryStatus?.cry_label && String(cryStatus.cry_label).trim()) ||
          (cryStatus?.cry_detected &&
          cryStatus?.message &&
          !String(cryStatus.message).toLowerCase().includes('waiting')
            ? String(cryStatus.message).split('.')[0].trim().slice(0, 48)
            : '') ||
          'Hungry'
        }
        cryMaxProb={typeof cryStatus?.max_prob === 'number' ? cryStatus.max_prob : undefined}
        temperature={
          sensorData?.temperature != null ? `${Number(sensorData.temperature).toFixed(0)}°C` : undefined
        }
        humidity={
          sensorData?.humidity != null ? `${Number(sensorData.humidity).toFixed(0)}%` : undefined
        }
        light={sensorData?.light_dark ? 'Dark' : 'Bright'}
        motion={sensorData?.motion ? 'Detected' : 'None'}
      />
    </div>
  );
}
