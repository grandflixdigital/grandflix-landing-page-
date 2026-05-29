// Navbar scroll effect
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Carousel functionality
const track = document.getElementById('featured-track');
const prevBtn = document.querySelector('.prev-btn');
const nextBtn = document.querySelector('.next-btn');

// Adjust scroll amount based on card width
const getScrollAmount = () => {
    const card = track.querySelector('.content-card');
    if (card) {
        // card width + gap
        return card.offsetWidth + 20; 
    }
    return 320; // fallback
};

nextBtn.addEventListener('click', () => {
    track.scrollBy({
        left: getScrollAmount(),
        behavior: 'smooth'
    });
});

prevBtn.addEventListener('click', () => {
    track.scrollBy({
        left: -getScrollAmount(),
        behavior: 'smooth'
    });
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80, // Offset for navbar
                behavior: 'smooth'
            });
        }
    });
});




// --- UNIFIED MEDIA CONTROLLER ---
const MediaController = {
    players: [],
    isPausing: false,
    
    register(player) {
        this.players.push(player);
    },
    
    pauseAllExcept(currentPlayer) {
        if (this.isPausing) return;
        this.isPausing = true;
        
        console.log(`[MediaController] Pausing all except:`, currentPlayer);
        
        this.players.forEach(player => {
            if (player !== currentPlayer) {
                player.pause();
            }
        });
        
        // Brief timeout to let pause commands propagate before unlocking
        setTimeout(() => {
            this.isPausing = false;
        }, 100);
    }
};

class BasePlayer {
    constructor(container) {
        this.container = container;
        this.placeholder = container.querySelector('.video-placeholder');
        this.wrapper = container.querySelector('.video-player-wrapper');
        this.skeleton = container.querySelector('.skeleton-loader');
        this.type = container.dataset.videoType;
        this.initialized = false;
        
        if (this.placeholder) {
            this.placeholder.addEventListener('click', () => this.play());
        }
    }
    
    showLoading() {
        if (this.skeleton) this.skeleton.classList.add('active');
        if (this.placeholder) this.placeholder.classList.add('hidden');
    }
    
    hideLoading() {
        if (this.skeleton) this.skeleton.classList.remove('active');
    }
}


class YouTubePlayer extends BasePlayer {
    constructor(container) {
        super(container);
        this.videoId = container.dataset.videoId;
        this.player = null;
        MediaController.register(this);
    }
    
    async play() {
        if (!this.initialized) {
            this.showLoading();
            const tempDiv = document.createElement('div');
            this.wrapper.appendChild(tempDiv);
            
            this.player = new YT.Player(tempDiv, {
                height: '100%',
                width: '100%',
                videoId: this.videoId,
                playerVars: { 'autoplay': 1, 'modestbranding': 1, 'rel': 0 },
                events: {
                    'onReady': () => {
                        this.hideLoading();
                        this.initialized = true;
                        this.container.classList.add('is-playing');
                        MediaController.pauseAllExcept(this);
                    },
                    'onStateChange': (event) => {
                        if (event.data === YT.PlayerState.PLAYING) {
                            this.container.classList.add('is-playing');
                            MediaController.pauseAllExcept(this);
                        } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                            this.container.classList.remove('is-playing');
                        }
                    }
                }
            });
        } else if (this.player && this.player.playVideo) {
            this.player.playVideo();
            this.container.classList.add('is-playing');
            MediaController.pauseAllExcept(this);
        }
    }
    
    pause() {
        if (this.player && this.player.pauseVideo) {
            try {
                this.player.pauseVideo();
                this.container.classList.remove('is-playing');
            } catch (e) {
                console.warn("Error pausing YT player", e);
            }
        }
    }
}

class FacebookPlayer extends BasePlayer {
    constructor(container, id) {
        super(container);
        this.id = id;
        this.videoUrl = container.dataset.videoUrl;
        this.player = null;
        MediaController.register(this);
        
        // Inject the fb-video div immediately as required
        this.fbDiv = document.createElement('div');
        this.fbDiv.id = this.id;
        this.fbDiv.className = 'fb-video';
        this.fbDiv.dataset.href = this.videoUrl;
        this.fbDiv.dataset.allowfullscreen = "true";
        this.fbDiv.dataset.autoplay = "false";
        this.fbDiv.dataset.width = "auto";
        this.wrapper.appendChild(this.fbDiv);
        
    }
    
    setPlayerInstance(instance) {
        this.player = instance;
        this.initialized = true;
        this.hideLoading();
        
        this.player.subscribe('startedPlaying', () => {
            console.log(`[FB] Video started: ${this.id}`);
            this.container.classList.add('is-playing');
            MediaController.pauseAllExcept(this);
        });

        this.player.subscribe('paused', () => {
            this.container.classList.remove('is-playing');
        });

        this.player.subscribe('finishedPlaying', () => {
            this.container.classList.remove('is-playing');
        });
    }
    
    play() {
        // Immediate UI feedback to prevent double buttons
        this.container.classList.add('is-playing');
        this.placeholder.classList.add('hidden');
        
        MediaController.pauseAllExcept(this);
        if (this.player) {
            this.player.play();
        } else {
            this.showLoading();
            this.pendingPlay = true;
        }
    }
    
    pause() {
        if (this.player && this.player.pause) {
            try {
                this.player.pause();
                this.container.classList.remove('is-playing');
            } catch (e) {
                console.warn("Error pausing FB player", e);
            }
        }
    }
}


// Load SDKs and Initialize
function loadSDKs() {
    // YouTube
    const ytTag = document.createElement('script');
    ytTag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(ytTag);

    // Facebook
    window.fbAsyncInit = function() {
        FB.init({
            appId: 'your-app-id', 
            xfbml: false, // We will call parse manually
            version: 'v18.0'
        });
        
        // Global listener for FB players
        FB.Event.subscribe('xfbml.ready', (msg) => {
            if (msg.type === 'video') {
                const playerObj = MediaController.players.find(p => p.id === msg.id);
                if (playerObj) {
                    playerObj.setPlayerInstance(msg.instance);
                    if (playerObj.pendingPlay) {
                        playerObj.play();
                        playerObj.pendingPlay = false;
                    }
                }
            }
        });
        
        // Initialize FB players after SDK is ready
        initMedia();
        FB.XFBML.parse();
    };

    (function(d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return;
        js = d.createElement(s); js.id = id;
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
}

let mediaInitialized = false;
function initMedia() {
    if (mediaInitialized) return;
    mediaInitialized = true;
    document.querySelectorAll('.video-container').forEach((container, index) => {
        if (container.dataset.videoType === 'youtube') {
            new YouTubePlayer(container);
        } else if (container.dataset.videoType === 'facebook') {
            const section = container.closest('section').id || 'section';
            const uniqueId = `fb-${section}-${index}`;
            new FacebookPlayer(container, uniqueId);
        }
    });
}

// YT API callback
window.onYouTubeIframeAPIReady = () => {
    // If FB SDK is already init, we can init YT here too
    // But we'll let initMedia handle it called from fbAsyncInit or here
    if (typeof FB !== 'undefined' && FB.init) {
        // already handled
    } else {
        initMedia();
    }
};

loadSDKs();