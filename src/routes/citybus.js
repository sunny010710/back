// src/routes/citybus.js

const express = require('express');
const axios   = require('axios');
const proj4   = require('proj4');
const router  = express.Router();

// EPSG:4326 → EPSG:5179 (국토부 TM 좌표계)
proj4.defs('EPSG:5179',
  '+proj=tmerc +lat_0=38 +lon_0=127.5 '
  + '+k=1 +x_0=200000 +y_0=600000 '
  + '+ellps=GRS80 +units=m +no_defs'
);

const BUS_STATION_KEY = process.env.BUS_STATION_KEY;  // 정류장/노선정보 조회용
const TAGO_KEY        = process.env.TAGO_KEY;         // 도착정보 조회용

// 1) 반경 내 정류장 목록 조회
router.get('/stops', async (req, res) => {
  const { lat, lng, radius = 400 } = req.query;
  const [tmX, tmY] = proj4('EPSG:4326','EPSG:5179', [parseFloat(lng), parseFloat(lat)]);
  try {
    const { data } = await axios.get(
      'https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCrdntPrxmtSttnList',
      { params: { serviceKey: BUS_STATION_KEY, tmX, tmY, radius, _type: 'json' } }
    );
    const items = data.response?.body?.items?.item || [];
    const list  = Array.isArray(items) ? items : [items];
    res.json(list.map(st => ({
      nodeId:    st.nodeid,
      stationNo: st.nodeno,
      stationNm: st.nodenm,
      lat:       parseFloat(st.gpslati),
      lng:       parseFloat(st.gpslong)
    })));
  } catch (err) {
    console.error('Error in /stops:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2) 정류장 이름 검색
router.get('/stops/search', async (req, res) => {
  const { name, cityCode } = req.query;
  try {
    const { data } = await axios.get(
      'https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getSttnNoList',
      { params: { serviceKey: BUS_STATION_KEY, cityCode, nodeNm: name, numOfRows: 100, pageNo: 1, _type: 'json' } }
    );
    const items = data.response?.body?.items?.item || [];
    const list  = Array.isArray(items) ? items : [items];
    res.json(list.map(st => ({
      nodeId:    st.nodeid,
      stationNo: st.nodeno,
      stationNm: st.nodenm,
      lat:       parseFloat(st.gpslati),
      lng:       parseFloat(st.gpslong)
    })));
  } catch (err) {
    console.error('Error in /stops/search:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3) 정류소별 도착예정정보 조회(분 단위)
router.get('/stops/:nodeId/arrivals', async (req, res) => {
  const { nodeId }   = req.params;
  const { cityCode } = req.query;

  try {
    const { data } = await axios.get(
      'https://apis.data.go.kr/1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList',
      { params: { serviceKey: TAGO_KEY, cityCode, nodeId, pageNo: 1, numOfRows: 20, _type: 'json' } }
    );

    const items = data.response?.body?.items?.item || [];
    const list  = Array.isArray(items) ? items : [items];

    // st.arrtime (초 단위)을 60으로 나누어 분 단위로 변환
    const arrivals = list.map(st => ({
      routeId:      st.routeid,
      routeNo:      st.routeno,
      arrivalInMin: Math.floor(Number(st.arrtime) / 60), // 초를 분으로 변환
    }));

    res.json(arrivals);
  } catch (err) {
    console.error('Error in /stops/:nodeId/arrivals:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4) 노선별 경유 정류소 목록 조회
router.get('/routes/:routeId/stops', async (req, res) => {
  const { routeId }  = req.params;
  const { cityCode } = req.query;

  try {
    const { data } = await axios.get(
      'https://apis.data.go.kr/1613000/BusRouteInfoInqireService/getRouteAcctoThrghSttnList',
      { params: { serviceKey: BUS_STATION_KEY, cityCode, routeId, pageNo: 1, numOfRows: 100, _type: 'json' } }
    );

    const items = data.response?.body?.items?.item || [];
    const list  = Array.isArray(items) ? items : [items];

    const stops = list
      .map(st => ({ seq: Number(st.nodeord), stationId: st.nodeid, stationNm: st.nodenm }))
      .sort((a, b) => a.seq - b.seq);

    res.json(stops);
  } catch (err) {
    console.error('Error in /routes/:routeId/stops:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

module.exports = router;