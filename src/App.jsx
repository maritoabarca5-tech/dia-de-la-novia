import { useState, useEffect, useRef } from 'react';
import './index.css';
import MOCK_TRACKS from './tracks.json';

function App() {
  const [currentTrack, setCurrentTrack] = useState(MOCK_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showLyrics, setShowLyrics] = useState(false);
  const [syncOffset, setSyncOffset] = useState(0);
  const [translatedLyrics, setTranslatedLyrics] = useState([]);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const audioRef = useRef(null);
  const lyricsScrollRef = useRef(null);

  // Reset offset + translation when track changes
  useEffect(() => {
    setSyncOffset(currentTrack.defaultSyncOffset || 0);
    setTranslatedLyrics([]);
    setShowTranslation(false);
  }, [currentTrack]);

  // Parse lyrics LRC format
  const parsedLyrics = currentTrack.lyrics 
    ? currentTrack.lyrics.split('\n').map((line, idx) => {
        const match = line.match(/\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
        if (match) {
          const originalTime = parseInt(match[1]) * 60 + parseFloat(match[2]);
          return { time: originalTime + syncOffset, text: match[3].trim(), id: idx };
        }
        return { time: 0, text: line.trim(), id: idx };
      }).filter(l => l.text !== "")
    : [];

  // Find active line
  let activeLineIndex = -1;
  for (let i = 0; i < parsedLyrics.length; i++) {
    if (currentTime >= parsedLyrics[i].time) {
      activeLineIndex = i;
    } else {
      break;
    }
  }

  // Detect if lyrics are in English
  const isEnglish = currentTrack.lang === 'en' || (parsedLyrics.length > 0 && (() => {
    const sample = parsedLyrics.slice(0, 5).map(l => l.text).join(' ');
    const spanishWords = /\b(que|con|una|por|los|las|del|para|pero|como|cuando|todo|este|esta|fue|hay|sin|sus|han|ser|son|más|muy|también|así|era|está|bien|si|no|ya|yo|me|te|le|se|al|en|de|la|el|es|un|una)\b/gi;
    const matches = sample.match(spanishWords) || [];
    return matches.length < 3;
  })());

  const translateLyrics = async () => {
    if (translatedLyrics.length > 0) {
      setShowTranslation(t => !t);
      return;
    }
    setIsTranslating(true);
    try {
      const translated = await Promise.all(
        parsedLyrics.map(async (lrc) => {
          if (!lrc.text) return { ...lrc, translated: '' };
          const res = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(lrc.text)}&langpair=en|es`
          );
          const data = await res.json();
          return { ...lrc, translated: data.responseData?.translatedText || lrc.text };
        })
      );
      setTranslatedLyrics(translated);
      setShowTranslation(true);
    } catch (e) {
      console.error('Translation failed', e);
    }
    setIsTranslating(false);
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, []);

  useEffect(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]);

  const isLyricsJustOpened = useRef(false);

  useEffect(() => {
    if (showLyrics) {
      isLyricsJustOpened.current = true;
      // Wait for slide-up animation (600ms) then jump instantly to active line
      const timer = setTimeout(() => {
        if (lyricsScrollRef.current) {
          const activeElement = lyricsScrollRef.current.querySelector('.lyric-line.active');
          if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'instant', block: 'center' });
          }
        }
        isLyricsJustOpened.current = false;
      }, 650);
      return () => clearTimeout(timer);
    }
  }, [showLyrics]);

  useEffect(() => {
    if (showLyrics && !isLyricsJustOpened.current && lyricsScrollRef.current) {
      const activeElement = lyricsScrollRef.current.querySelector('.lyric-line.active');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex]);

  const handleLyricClick = (time) => {
    if (currentTrack.isSynced && time > 0 && audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handlePlay = (track) => {
    if (currentTrack.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const nextTrack = () => {
    const currentIndex = MOCK_TRACKS.findIndex((t) => t.id === currentTrack.id);
    setCurrentTrack(MOCK_TRACKS[(currentIndex + 1) % MOCK_TRACKS.length]);
    setIsPlaying(true);
  };

  const prevTrack = () => {
    const currentIndex = MOCK_TRACKS.findIndex((t) => t.id === currentTrack.id);
    setCurrentTrack(MOCK_TRACKS[(currentIndex - 1 + MOCK_TRACKS.length) % MOCK_TRACKS.length]);
    setIsPlaying(true);
  };

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    setDuration(audioRef.current.duration);
  };

  const handleProgressClick = (e) => {
    if (!duration) return;
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeClick = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newVolume = Math.max(0, Math.min(1, clickX / rect.width));
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar glass-panel">
        <div className="logo">
          <i className="fa-solid fa-heart heart-beat"></i>
          <span>Nuestro Spotify</span>
        </div>
        <nav>
          <ul>
            <li className="active"><i className="fa-solid fa-house"></i> Inicio</li>
            <li><i className="fa-solid fa-magnifying-glass"></i> Buscar</li>
            <li><i className="fa-solid fa-book-open"></i> Tu Biblioteca</li>
          </ul>
        </nav>
        <div className="playlists">
          <h3>TUS PLAYLISTS</h3>
          <ul>
            <li>Canciones que me recuerdan a ti</li>
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content glass-panel">
        <header className="header">
          <div className="nav-buttons">
            <button className="icon-btn"><i className="fa-solid fa-chevron-left"></i></button>
            <button className="icon-btn"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
          <div className="user-profile">
            <div className="profile-pic">
              <img src="/PORTADA.png" alt="Profile" style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%'}} />
            </div>
            <span>Tú y yo</span>
          </div>
        </header>

        <section className="playlist-header">
          <div className="playlist-cover glass-panel">
            <img src="/PORTADA.png" alt="Cover" className="cover-img" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
            <i className="fa-solid fa-image placeholder-icon" style={{display: 'none'}}></i>
          </div>
          <div className="playlist-info">
            <span className="type">PLAYLIST PÚBLICA</span>
            <h1>Canciones que me recuerdan a ti</h1>
            <p className="description">Una lista de canciones que me recuerdan a ti y que tienen algo que decirte</p>
            <div className="meta">
              <span>Creado con amor</span> • <span>{MOCK_TRACKS.length} canciones</span>
            </div>
          </div>
        </section>

        <div className="action-buttons">
          <button className="play-btn" onClick={handlePlayPause}>
            <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
          </button>
          <button className="icon-btn outline"><i className="fa-regular fa-heart"></i></button>
          <button className="icon-btn outline"><i className="fa-solid fa-ellipsis"></i></button>
        </div>

        <section className="track-list">
          <div className="track-header">
            <div className="col-index">#</div>
            <div className="col-title">TÍTULO</div>
            <div className="col-album"><i className="fa-solid fa-heart" style={{color: 'var(--accent-color)', marginRight: '6px', fontSize: '11px'}}></i>MENSAJE</div>
            <div className="col-date">FECHA AÑADIDA</div>
            <div className="col-duration"><i className="fa-regular fa-clock"></i></div>
          </div>

          <div className="tracks-container">
            {MOCK_TRACKS.map((track, index) => {
              const isActive = track.id === currentTrack.id;
              return (
                <div 
                  key={track.id} 
                  className={`track-item ${isActive ? 'playing' : ''}`}
                  onClick={() => handlePlay(track)}
                >
                  <div className="col-index">
                    {isActive && isPlaying ? (
                      <div className="playing-eq">
                        <span></span><span></span><span></span><span></span>
                      </div>
                    ) : index + 1}
                  </div>
                  <div className="col-title track-title">
                    <div className="track-img glass-panel" style={{ overflow: 'hidden' }}>
                      {track.cover ? (
                        <img src={track.cover} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <i className="fa-solid fa-music"></i>
                      )}
                    </div>
                    <div className="track-info-text">
                      <strong>{track.title}</strong>
                      <span>{track.artist}</span>
                    </div>
                  </div>
                  <div className="col-album" style={{color: 'var(--accent-color)', fontStyle: 'italic', fontSize: '13px'}}>{track.album}</div>
                  <div className="col-date">{track.date}</div>
                  <div className="col-duration">{track.duration}</div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {showLyrics && (
        <div className="lyrics-view animate-slide-up">
          <div className="lyrics-bg" style={{backgroundImage: `url(${currentTrack.cover})`}}></div>
          
          {currentTrack.isSynced && (
            <div className="lyrics-sync-controls">
              <button onClick={() => setSyncOffset(o => o + 0.5)} title="Atrasar letra"><i className="fa-solid fa-backward"></i></button>
              <span>Ajustar sincronía {syncOffset > 0 ? `(+${syncOffset.toFixed(1)}s)` : syncOffset < 0 ? `(${syncOffset.toFixed(1)}s)` : ''}</span>
              <button onClick={() => setSyncOffset(o => o - 0.5)} title="Adelantar letra"><i className="fa-solid fa-forward"></i></button>
            </div>
          )}

          {isEnglish && parsedLyrics.length > 0 && (
            <button 
              className={`translate-btn ${showTranslation ? 'active' : ''}`}
              onClick={translateLyrics}
              title="Traducir al español"
            >
              {isTranslating ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Traduciendo...</>
              ) : showTranslation ? (
                <><i className="fa-solid fa-language"></i> Ver original</>
              ) : (
                <><i className="fa-solid fa-language"></i> Traducir al español</>
              )}
            </button>
          )}

          <div className="lyrics-content" ref={lyricsScrollRef}>
            {parsedLyrics.length > 0 ? (
              parsedLyrics.map((lrc, idx) => (
                <p 
                  key={lrc.id} 
                  className={`lyric-line ${idx === activeLineIndex ? 'active' : ''} ${idx < activeLineIndex ? 'passed' : ''}`}
                  onClick={() => handleLyricClick(lrc.time)}
                >
                  {showTranslation && translatedLyrics[idx] 
                    ? translatedLyrics[idx].translated 
                    : lrc.text}
                </p>
              ))
            ) : (
              <p className="lyric-line active">Instrumental / No lyrics found</p>
            )}
          </div>
          <button className="close-lyrics-btn" onClick={() => setShowLyrics(false)}>
            <i className="fa-solid fa-chevron-down"></i>
          </button>
        </div>
      )}

      {/* Player Dock */}
      <footer className="player glass-panel">
        <div className="now-playing">
          <div className="now-playing-img glass-panel" style={{ overflow: 'hidden' }}>
            {currentTrack.cover ? (
              <img src={currentTrack.cover} alt={currentTrack.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <i className="fa-solid fa-music"></i>
            )}
          </div>
          <div className="track-info">
            <h4>{currentTrack.title}</h4>
            <p>{currentTrack.artist}</p>
          </div>
          <button className="icon-btn small"><i className="fa-regular fa-heart"></i></button>
        </div>

        <div className="player-controls">
          <div className="buttons">
            <button className="icon-btn" onClick={prevTrack}><i className="fa-solid fa-backward-step"></i></button>
            <button className="play-pause-btn" onClick={handlePlayPause}>
              <i className={`fa-solid ${isPlaying ? 'fa-circle-pause' : 'fa-circle-play'}`}></i>
            </button>
            <button className="icon-btn" onClick={nextTrack}><i className="fa-solid fa-forward-step"></i></button>
          </div>
          <div className="progress-container">
            <span className="time current-time">{formatTime(currentTime)}</span>
            <div className="progress-bar" onClick={handleProgressClick}>
              <div className="progress-fill" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}></div>
            </div>
            <span className="time total-time">{currentTrack.duration}</span>
          </div>
        </div>

        <div className="extra-controls">
          <button className={`icon-btn ${showLyrics ? 'active-mic' : ''}`} onClick={() => setShowLyrics(!showLyrics)}>
            <i className="fa-solid fa-microphone"></i>
          </button>
          <div className="volume-container">
            <i className={`fa-solid ${volume === 0 ? 'fa-volume-xmark' : volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high'}`}></i>
            <div className="progress-bar volume-bar" onClick={handleVolumeClick}>
              <div className="progress-fill" style={{ width: `${volume * 100}%` }}></div>
            </div>
          </div>
        </div>
        <audio 
          ref={audioRef} 
          src={currentTrack.src} 
          onEnded={nextTrack}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
        />
      </footer>
    </div>
  );
}

export default App;
