// 鱼类数据
const FISH_TYPES = [
    { name: '蝴蝶鱼', weight: 5, value: 5, size: 50, emoji: '🦋', image: '蝴蝶鱼.gif' },
    { name: '小丑鱼', weight: 8, value: 10, size: 60, emoji: '🐠', image: '小丑鱼.gif' },
    { name: '石斑鱼', weight: 10, value: 20, size: 70, emoji: '🐟', image: '石斑鱼.gif' },
    { name: '金枪鱼', weight: 15, value: 40, size: 80, emoji: '🐟', image: '金枪鱼.gif' },
    { name: '剑鱼', weight: 25, value: 80, size: 90, emoji: '🗡️', image: '剑鱼.gif' },
    { name: '马林鱼', weight: 40, value: 160, size: 100, emoji: '🐋', image: '马林鱼.gif' },
    { name: '翻车鱼', weight: 50, value: 320, size: 110, emoji: '🐡', image: '翻车鱼.gif' },
    { name: '大白鲨', weight: 70, value: 500, size: 130, emoji: '🦈', image: '大白鲨.gif' },
    { name: '鲸鲨', weight: 90, value: 1000, size: 150, emoji: '🦈', image: '鲸鲨.gif' },
    { name: '皇带鱼', weight: 100, value: 1500, size: 170, emoji: '🐍', image: '皇带鱼.gif' }
];

// 小鱼数据
const SMALL_FISH = {
    name: '小鱼',
    weight: 10,
    value: 1,
    size: 30,
    emoji: '🐟',
    image: '小鱼.gif',
    isSmallFish: true
};

// 宝箱数据
const TREASURE_CHEST = {
    name: '宝箱',
    weight: 249,
    value: 4000,
    image: '宝箱.gif'
};

// 游戏常量
const MAX_DEPTH = 250;
const DEPTH_PER_SCREEN = 50;
const DESCEND_SPEED = 5;
const ASCEND_SPEED = 10;
const MAX_WEIGHT = 250;
const INITIAL_MAX_WEIGHT = 250;
const SCREEN_2_3_RATIO = 0.667;
const MAX_COLLISIONS = 3;

// 移动端配置
const MOBILE_SCALE = 0.45;  // 鱼图片缩放系数（移动端）
const IS_MOBILE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// 游戏状态
const GameState = {
    START: 'start',
    DESCENDING: 'descending',
    ASCENDING: 'ascending',
    FAILED: 'failed',
    WON: 'won'
};

// 游戏类
class DeepSeaFishingGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeCanvas(), 100);
        });
        
        this.state = GameState.START;
        this.depth = 0;
        this.maxDepthReached = 0;
        this.hookX = this.canvas.width / 2;
        this.hookWorldY = 0; // 钩子世界Y坐标（玩家控制）
        this.hookYOffset = 0;
        this.collisionCount = 0;
        this.currentWeight = 0;
        this.currentMaxWeight = INITIAL_MAX_WEIGHT;
        this.caughtFish = [];
        this.flashTimer = 0;
        this.fishes = [];
        this.particles = [];
        this.lastTime = 0;
        this.touching = false;
        
        // 虚拟摇杆状态
        this.joystickActive = false;
        this.joystickCenterX = 0;
        this.joystickCenterY = 0;
        this.joystickDeltaX = 0; // 摇杆相对位移 (-1 ~ 1)
        this.joystickDeltaY = 0;
        
        // 初始化摇杆（延迟确保DOM已加载）
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initJoystick());
        } else {
            this.initJoystick();
        }
        
        // 宝箱
        this.treasureChest = null;
        this.chestImage = new Image();
        this.chestImage.src = TREASURE_CHEST.image;
        this.chestImageLoaded = false;
        this.chestImage.onload = () => {
            this.chestImageLoaded = true;
        };
        
        // 卷轴滚动相关
        this.cameraY = 0;
        this.worldHeight = MAX_DEPTH * (this.canvas.height / DEPTH_PER_SCREEN);
        this.pixelsPerMeter = this.canvas.height / DEPTH_PER_SCREEN;
        
        this.seaLevel = 0;
        this.seaBottomY = MAX_DEPTH * this.pixelsPerMeter;
        
        // 鱼类图片缓存
        this.fishImages = {};
        this.imagesLoaded = false;
        
        // 鱼钩图片
        this.hookImage = new Image();
        this.hookImage.src = '鱼钩2.gif';
        this.hookImageLoaded = false;
        this.hookImage.onload = () => {
            this.hookImageLoaded = true;
        };
        
        // 音频上下文
        this.audioContext = null;
        
        // 预加载鱼类图片
        this.loadFishImages();
        
        // 绑定事件
        this.bindEvents();
        
        // 开始游戏循环
        this.gameLoop(0);
    }
    
    resizeCanvas() {
        const oldWidth = this.canvas.width;
        const oldHeight = this.canvas.height;
        
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.pixelsPerMeter = this.canvas.height / DEPTH_PER_SCREEN;
        
        // 重置鱼钩位置到屏幕中央
        if (oldWidth > 0) {
            this.hookX = this.canvas.width / 2;
        }
        
        // 更新世界高度
        this.worldHeight = MAX_DEPTH * this.pixelsPerMeter;
        this.seaBottomY = MAX_DEPTH * this.pixelsPerMeter;
    }
    
    // 获取移动端缩放系数
    getMobileScale() {
        if (!IS_MOBILE) return 1;
        // 根据屏幕宽度调整缩放，基准是375px（iPhone SE宽度）
        const scale = Math.min(1, this.canvas.width / 375);
        return MOBILE_SCALE * scale;
    }
    
    loadFishImages() {
        const loadedCount = { count: 0 };
        const totalImages = FISH_TYPES.length + 1;
        
        FISH_TYPES.forEach(fishType => {
            const img = new Image();
            img.src = fishType.image;
            img.onload = () => {
                loadedCount.count++;
                if (loadedCount.count === totalImages) {
                    this.imagesLoaded = true;
                }
            };
            img.onerror = () => {
                loadedCount.count++;
            };
            this.fishImages[fishType.image] = img;
        });
        
        const smallFishImg = new Image();
        smallFishImg.src = SMALL_FISH.image;
        smallFishImg.onload = () => {
            loadedCount.count++;
            if (loadedCount.count === totalImages) {
                this.imagesLoaded = true;
            }
        };
        smallFishImg.onerror = () => {
            loadedCount.count++;
        };
        this.fishImages[SMALL_FISH.image] = smallFishImg;
    }
    
    bindEvents() {
        const gameContainer = document.getElementById('gameContainer');
        
        // 触摸事件（移动端）
        if (IS_MOBILE) {
            gameContainer.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
            gameContainer.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            gameContainer.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        }
        
        // 鼠标事件（桌面端）
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        gameContainer.addEventListener('click', (e) => this.handleClick(e));
        
        document.getElementById('retryBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.restart();
        });
        document.getElementById('playAgainBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.restart();
        });
    }
    
    initJoystick() {
        const joystickBase = document.getElementById('joystickBase');
        const joystickKnob = document.getElementById('joystickKnob');
        
        if (!joystickBase || !joystickKnob) {
            console.warn('Joystick elements not found');
            return;
        }
        
        // 延迟确保DOM已完全渲染
        requestAnimationFrame(() => {
            this.updateJoystickCenter();
        });
        
        const updateJoystickCenter = () => {
            const rect = joystickBase.getBoundingClientRect();
            this.joystickCenterX = rect.left + rect.width / 2;
            this.joystickCenterY = rect.top + rect.height / 2;
            this.joystickMaxRadius = rect.width / 2 - joystickKnob.offsetWidth / 2;
        };
        
        const handleJoystickMove = (clientX, clientY) => {
            updateJoystickCenter();
            
            const dx = clientX - this.joystickCenterX;
            const dy = clientY - this.joystickCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 防止除以零
            if (this.joystickMaxRadius <= 0) return;
            
            // 计算摇杆位移比例
            let ratio = 1;
            if (distance > this.joystickMaxRadius) {
                ratio = this.joystickMaxRadius / distance;
            }
            
            // 更新摇杆值（-1 到 1）
            this.joystickDeltaX = Math.max(-1, Math.min(1, (dx * ratio) / this.joystickMaxRadius));
            this.joystickDeltaY = Math.max(-1, Math.min(1, (dy * ratio) / this.joystickMaxRadius));
            
            // 更新摇杆旋钮位置
            const knobX = dx * ratio;
            const knobY = dy * ratio;
            joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
        };
        
        const handleJoystickStart = (clientX, clientY) => {
            this.joystickActive = true;
            this.initAudio();
            
            // 开始画面时，点击摇杆区域也启动游戏
            if (this.state === GameState.START) {
                this.startGame();
            }
            
            handleJoystickMove(clientX, clientY);
        };
        
        const handleJoystickEnd = () => {
            this.joystickActive = false;
            this.joystickDeltaX = 0;
            this.joystickDeltaY = 0;
            joystickKnob.style.transform = 'translate(-50%, -50%)';
            // 不重置 hookWorldY，钩子保持在当前位置
        };
        
        // 触摸事件
        joystickBase.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleJoystickStart(touch.clientX, touch.clientY);
        }, { passive: false });
        
        joystickBase.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.joystickActive) return;
            const touch = e.touches[0];
            handleJoystickMove(touch.clientX, touch.clientY);
        }, { passive: false });
        
        joystickBase.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleJoystickEnd();
        }, { passive: false });
        
        joystickBase.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            handleJoystickEnd();
        }, { passive: false });
        
        // 鼠标事件（桌面浏览器测试用）
        joystickBase.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handleJoystickStart(e.clientX, e.clientY);
            
            const handleMouseMove = (e) => {
                if (!this.joystickActive) return;
                handleJoystickMove(e.clientX, e.clientY);
            };
            
            const handleMouseUp = () => {
                handleJoystickEnd();
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        
        // 更新摇杆中心位置（窗口大小变化时）
        window.addEventListener('resize', () => {
            requestAnimationFrame(() => this.updateJoystickCenter());
        });
        
        // 也监听 orientationchange
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                requestAnimationFrame(() => this.updateJoystickCenter());
            }, 100);
        });
    }
    
    updateJoystickCenter() {
        const joystickBase = document.getElementById('joystickBase');
        const joystickKnob = document.getElementById('joystickKnob');
        if (!joystickBase || !joystickKnob) return;
        
        const rect = joystickBase.getBoundingClientRect();
        this.joystickCenterX = rect.left + rect.width / 2;
        this.joystickCenterY = rect.top + rect.height / 2;
        this.joystickMaxRadius = rect.width / 2 - joystickKnob.offsetWidth / 2;
    }
    
    handleTouchStart(e) {
        this.initAudio();
        this.touching = true;
        
        if (this.state === GameState.START) {
            this.startGame();
        }
        // 不再通过屏幕触摸控制钩子位置，统一使用摇杆
    }
    
    handleTouchMove(e) {
        // 不再通过屏幕触摸控制钩子位置，统一使用摇杆
    }
    
    handleTouchEnd(e) {
        this.touching = false;
    }
    
    handleClick(e) {
        // 如果是触摸触发的点击，不处理（避免重复）
        if (this.touching) return;
        
        this.initAudio();
        
        if (this.state === GameState.START) {
            this.startGame();
        }
        // 取消点击上升功能
    }
    
    handleMouseMove(e) {
        if (this.state === GameState.DESCENDING || this.state === GameState.ASCENDING) {
            this.hookX = e.clientX;
        }
        if (this.state === GameState.DESCENDING) {
            const defaultY = this.getDefaultHookScreenY();
            const maxOffset = 10 * this.pixelsPerMeter;
            this.hookYOffset = Math.max(-maxOffset, Math.min(maxOffset, e.clientY - defaultY));
        }
    }
    
    startGame() {
        this.state = GameState.DESCENDING;
        this.depth = 0;
        this.cameraY = 0;
        this.collisionCount = 0;
        this.caughtFish = [];
        this.fishes = [];
        this.particles = [];
        this.currentWeight = 0;
        this.currentMaxWeight = INITIAL_MAX_WEIGHT;
        
        // 初始化钩子世界Y坐标：初始在屏幕上距离顶部100像素的位置
        this.hookWorldY = this.cameraY + 100;
        
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('weightCounter').style.display = 'block';
        this.updateWeightDisplay();
        
        this.generateFishes();
    }
    
    generateFishes() {
        this.fishes = [];
        
        const mobileScale = this.getMobileScale();
        
        // 根据屏幕分辨率计算密度系数
        const refArea = 375 * 667; // 手机参考屏幕
        const currentArea = this.canvas.width * this.canvas.height;
        const densityFactor = (currentArea / refArea) * 0.6; // 降低密度
        
        // 生成小鱼
        const smallFishCount = Math.max(6, Math.floor((50 + Math.random() * 30) * densityFactor));
        for (let i = 0; i < smallFishCount; i++) {
            const randomDepth = Math.random() * MAX_DEPTH;
            const worldY = randomDepth * this.pixelsPerMeter + this.canvas.height * 0.15 + 
                          Math.random() * (this.canvas.height * 0.5);
            
            const smallFishImage = this.fishImages[SMALL_FISH.image];
            let collisionRadius = (SMALL_FISH.size * mobileScale) / 2;
            if (smallFishImage && smallFishImage.complete) {
                collisionRadius = Math.min(smallFishImage.width, smallFishImage.height) * mobileScale / 2;
            }
            
            const smallFish = {
                ...SMALL_FISH,
                x: Math.random() * this.canvas.width,
                worldY: worldY,
                speed: (1 + Math.random() * 2) * 1.3,
                direction: Math.random() > 0.5 ? 1 : -1,
                caught: false,
                hasCollided: false,
                collisionRadius: collisionRadius,
                mobileScale: mobileScale
            };
            
            this.fishes.push(smallFish);
        }
        
        // 生成其他鱼类
        const otherFishCount = Math.max(5, Math.floor((30 + Math.random() * 20) * densityFactor));
        
        for (let i = 0; i < otherFishCount; i++) {
            let fishTypeIndex;
            const randomDepth = Math.random() * MAX_DEPTH;
            
            if (randomDepth < 50) {
                fishTypeIndex = Math.floor(Math.random() * 3);
            } else if (randomDepth < 100) {
                fishTypeIndex = Math.floor(Math.random() * 5);
            } else if (randomDepth < 150) {
                fishTypeIndex = Math.floor(Math.random() * 7);
            } else if (randomDepth < 200) {
                fishTypeIndex = Math.floor(Math.random() * 8);
            } else {
                fishTypeIndex = 8 + Math.floor(Math.random() * 2);
            }
            
            const fishType = FISH_TYPES[fishTypeIndex];
            const fishImage = this.fishImages[fishType.image];
            let collisionRadius = (fishType.size * mobileScale) / 2;
            if (fishImage && fishImage.complete) {
                collisionRadius = Math.min(fishImage.width, fishImage.height) * mobileScale / 2;
            }
            
            const worldY = randomDepth * this.pixelsPerMeter + this.canvas.height * 0.15 + 
                          Math.random() * (this.canvas.height * 0.5);
            
            const fish = {
                ...fishType,
                x: Math.random() * this.canvas.width,
                worldY: worldY,
                speed: 1 + Math.random() * 2,
                direction: Math.random() > 0.5 ? 1 : -1,
                caught: false,
                hasCollided: false,
                collisionRadius: collisionRadius,
                mobileScale: mobileScale
            };
            
            this.fishes.push(fish);
        }
        
        // 生成宝箱
        this.generateTreasureChest();
    }
    
    generateTreasureChest() {
        const randomDepth = 150 + Math.random() * 100;
        const mobileScale = this.getMobileScale();
        
        const baseX = Math.random() * (this.canvas.width - 60) + 30;
        const baseY = randomDepth * this.pixelsPerMeter + this.canvas.height * 0.2;
        
        this.treasureChest = {
            ...TREASURE_CHEST,
            x: baseX,
            baseX: baseX,
            worldY: baseY,
            baseWorldY: baseY,
            caught: false,
            hasCollided: false,
            collisionRadius: 30 * mobileScale,
            mobileScale: mobileScale
        };
    }
    
    updateTreasureChest(dt) {
        if (!this.treasureChest || this.treasureChest.caught) return;
        
        const time = Date.now() / 1000;
        const mobileScale = this.getMobileScale();
        
        this.treasureChest.worldY = this.treasureChest.baseWorldY + 
            Math.sin(time * 0.5) * this.pixelsPerMeter;
        this.treasureChest.x = this.treasureChest.baseX + 
            Math.sin(time * 0.3 + 1) * this.pixelsPerMeter * mobileScale;
    }
    
    startAscending() {
        if (this.state !== GameState.DESCENDING) return;
        
        this.state = GameState.ASCENDING;
        this.maxDepthReached = this.depth;
        this.updateWeightDisplay();
    }
    
    restart() {
        this.state = GameState.START;
        this.depth = 0;
        this.cameraY = 0;
        this.maxDepthReached = 0;
        this.hookX = this.canvas.width / 2;
        this.hookWorldY = 0;
        this.collisionCount = 0;
        this.currentWeight = 0;
        this.caughtFish = [];
        this.fishes = [];
        this.particles = [];
        this.treasureChest = null;
        
        document.getElementById('failScreen').style.display = 'none';
        document.getElementById('winScreen').style.display = 'none';
        document.getElementById('startScreen').style.display = 'flex';
        document.getElementById('weightCounter').style.display = 'none';
    }
    
    gameLoop(timestamp) {
        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        
        this.update(deltaTime);
        this.render();
        
        requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    update(dt) {
        if (this.state === GameState.DESCENDING) {
            this.updateDescending(dt);
        } else if (this.state === GameState.ASCENDING) {
            this.updateAscending(dt);
        }
        
        this.updateFishes(dt);
        this.updateTreasureChest(dt);
        this.updateParticles(dt);
        
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
        }
    }
    
    updateDescending(dt) {
        this.depth += DESCEND_SPEED * dt;
        this.cameraY = this.depth * this.pixelsPerMeter;
        
        // 更新钩子位置（摇杆控制）
        this.updateHookPosition(dt);
        
        if (this.depth >= MAX_DEPTH) {
            this.startAscending();
            return;
        }
        
        this.checkCollisions();
        this.updateWeightDisplay();
        
        if (this.collisionCount >= MAX_COLLISIONS) {
            // 碰鱼3次后自动上升
            this.startAscending();
        }
    }
    
    updateHookPosition(dt) {
        // 水平方向：直接设置位置
        this.hookX = this.canvas.width / 2 + this.joystickDeltaX * (this.canvas.width / 2);
        
        // 垂直方向：控制世界Y坐标
        if (this.state === GameState.DESCENDING) {
            // joystickDeltaY: 正=下，负=上
            // hookWorldY: 增加=下潜
            const moveSpeed = 0.8 * this.canvas.height;
            this.hookWorldY += this.joystickDeltaY * moveSpeed * dt;
            
            // 限制 hookWorldY 不会太小（屏幕上沿）
            const minHookWorldY = this.cameraY;
            if (this.hookWorldY < minHookWorldY) {
                this.hookWorldY = minHookWorldY;
            }
        }
    }
    
    updateAscending(dt) {
        this.depth -= ASCEND_SPEED * dt;
        this.cameraY = this.depth * this.pixelsPerMeter;
        
        // 更新钩子水平位置（摇杆控制）
        this.hookX = this.canvas.width / 2 + this.joystickDeltaX * (this.canvas.width / 2);
        
        // 上升阶段：允许摇杆控制垂直位置
        const moveSpeed = 0.8 * this.canvas.height;
        this.hookWorldY += this.joystickDeltaY * moveSpeed * dt;
        
        // 确保钩子不会超出屏幕底部
        const maxHookScreenY = this.canvas.height - 50;
        const currentScreenY = this.hookWorldY - this.cameraY;
        if (currentScreenY > maxHookScreenY) {
            this.hookWorldY = this.cameraY + maxHookScreenY;
        }
        
        if (this.depth <= 0) {
            this.depth = 0;
            this.cameraY = 0;
            this.winGame();
            return;
        }
        
        if (this.currentWeight >= this.currentMaxWeight) {
            this.failGame();
        }
        
        this.checkFishCatch();
        this.updateWeightDisplay();
    }
    
    updateFishes(dt) {
        const mobileScale = this.getMobileScale();
        
        this.fishes.forEach(fish => {
            if (fish.caught) return;
            
            fish.x += fish.speed * fish.direction * (IS_MOBILE ? 0.8 : 1);
            
            const fishImage = this.fishImages[fish.image];
            const width = (fishImage && fishImage.complete) ? fishImage.width * fish.mobileScale : fish.size;
            
            if (fish.x < -width) {
                fish.x = this.canvas.width + width;
            } else if (fish.x > this.canvas.width + width) {
                fish.x = -width;
            }
        });
    }
    
    updateParticles(dt) {
        this.particles = this.particles.filter(p => {
            p.x += p.vx * dt;
            if (!p.worldY) {
                p.worldY = p.y + this.cameraY;
            }
            p.vy += 200 * dt;
            p.worldY += p.vy * dt;
            p.y = p.worldY - this.cameraY;
            p.life -= dt;
            return p.life > 0 && p.y > -100 && p.y < this.canvas.height + 100;
        });
    }
    
    checkCollisions() {
        const hookScreenY = this.getHookScreenY();
        
        this.fishes.forEach(fish => {
            if (fish.caught || fish.hasCollided) return;
            
            const fishScreenY = fish.worldY - this.cameraY;
            if (fishScreenY < 80 || fishScreenY > this.canvas.height - 40) return;
            
            const distance = Math.sqrt(
                Math.pow(this.hookX - fish.x, 2) +
                Math.pow(hookScreenY - fishScreenY, 2)
            );
            
            let hookCollisionRadius = 12;
            if (this.hookImageLoaded && this.hookImage.complete) {
                hookCollisionRadius = Math.min(this.hookImage.width, this.hookImage.height) / 2 * this.getMobileScale();
            }
            
            if (distance < fish.collisionRadius + hookCollisionRadius) {
                this.collisionCount++;
                fish.hasCollided = true;
                this.currentMaxWeight = INITIAL_MAX_WEIGHT * (1 - this.collisionCount * 0.25);
                this.flashTimer = 0.2;
                this.playSound('warning');
                this.createCollisionParticles(fish.x, fishScreenY);
            }
        });
        
        if (this.treasureChest && !this.treasureChest.hasCollided) {
            const chestScreenY = this.treasureChest.worldY - this.cameraY;
            
            if (chestScreenY > 80 && chestScreenY < this.canvas.height - 40) {
                const distance = Math.sqrt(
                    Math.pow(this.hookX - this.treasureChest.x, 2) +
                    Math.pow(hookScreenY - chestScreenY, 2)
                );
                
                let hookCollisionRadius = 12;
                if (this.hookImageLoaded && this.hookImage.complete) {
                    hookCollisionRadius = Math.min(this.hookImage.width, this.hookImage.height) / 2 * this.getMobileScale();
                }
                
                if (distance < this.treasureChest.collisionRadius + hookCollisionRadius) {
                    this.collisionCount++;
                    this.treasureChest.hasCollided = true;
                    this.currentMaxWeight = INITIAL_MAX_WEIGHT * (1 - this.collisionCount * 0.25);
                    this.flashTimer = 0.2;
                    this.playSound('warning');
                    this.createCollisionParticles(this.treasureChest.x, chestScreenY);
                }
            }
        }
    }
    
    checkFishCatch() {
        const hookScreenY = this.getHookScreenY();
        
        this.fishes.forEach(fish => {
            if (fish.caught) return;
            
            const fishScreenY = fish.worldY - this.cameraY;
            if (fishScreenY < 80 || fishScreenY > this.canvas.height - 40) return;
            
            const distance = Math.sqrt(
                Math.pow(this.hookX - fish.x, 2) +
                Math.pow(hookScreenY - fishScreenY, 2)
            );
            
            let hookCollisionRadius = 12;
            if (this.hookImageLoaded && this.hookImage.complete) {
                hookCollisionRadius = Math.min(this.hookImage.width, this.hookImage.height) / 2 * this.getMobileScale();
            }
            
            if (distance < fish.collisionRadius + hookCollisionRadius) {
                fish.caught = true;
                this.caughtFish.push(fish);
                this.currentWeight += fish.weight;
                this.playSound('catch');
                this.createCatchParticles(fish.x, fishScreenY);
            }
        });
        
        if (this.treasureChest && !this.treasureChest.caught) {
            const chestScreenY = this.treasureChest.worldY - this.cameraY;
            
            if (chestScreenY > 80 && chestScreenY < this.canvas.height - 40) {
                const distance = Math.sqrt(
                    Math.pow(this.hookX - this.treasureChest.x, 2) +
                    Math.pow(hookScreenY - chestScreenY, 2)
                );
                
                let hookCollisionRadius = 12;
                if (this.hookImageLoaded && this.hookImage.complete) {
                    hookCollisionRadius = Math.min(this.hookImage.width, this.hookImage.height) / 2 * this.getMobileScale();
                }
                
                if (distance < this.treasureChest.collisionRadius + hookCollisionRadius) {
                    this.treasureChest.caught = true;
                    this.caughtFish.push(this.treasureChest);
                    this.currentWeight = 249;
                    this.playSound('catch');
                    this.createCatchParticles(this.treasureChest.x, chestScreenY);
                    this.updateWeightDisplay();
                }
            }
        }
    }
    
    createCollisionParticles(x, y) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 150,
                vy: (Math.random() - 0.5) * 150,
                life: 0.5,
                color: '#ff0000',
                size: 2 + Math.random() * 3
            });
        }
    }
    
    createCatchParticles(x, y) {
        for (let i = 0; i < 12; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 100,
                vy: (Math.random() - 0.5) * 100 - 80,
                life: 0.6,
                color: '#00ff00',
                size: 2 + Math.random() * 3
            });
        }
    }
    
    createBreakParticles() {
        const hookScreenY = this.getHookScreenY();
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: this.hookX,
                y: hookScreenY,
                vx: (Math.random() - 0.5) * 300,
                vy: (Math.random() - 0.5) * 300,
                life: 0.8,
                color: '#ffaa00',
                size: 2 + Math.random() * 4
            });
        }
    }
    
    getDefaultHookScreenY() {
        const twoThirdsY = this.canvas.height * SCREEN_2_3_RATIO;
        const initialY = IS_MOBILE ? 100 : 150;
        const maxVisibleDepth = DEPTH_PER_SCREEN;
        const progress = Math.min(this.depth, maxVisibleDepth) / maxVisibleDepth;
        return initialY + progress * (twoThirdsY - initialY);
    }
    
    getHookScreenY() {
        // 新系统：hookWorldY 是钩子的世界坐标
        // screenY = hookWorldY - cameraY， clamped 到最小值 0
        const screenY = this.hookWorldY - this.cameraY;
        return Math.max(0, screenY);
    }
    
    getHookWorldY() {
        return this.hookWorldY;
    }
    
    updateWeightDisplay() {
        const weightDisplay = document.getElementById('weightValue');
        const weightIcon = document.getElementById('weightIcon');
        
        const percentage = Math.min(this.currentWeight / this.currentMaxWeight, 1);
        const maxPercentage = this.currentMaxWeight / INITIAL_MAX_WEIGHT;
        const iconHeight = 200 * maxPercentage;
        weightIcon.style.setProperty('--icon-height', `${iconHeight}px`);
        weightIcon.style.setProperty('--mask-height', `${(1 - percentage) * 100}%`);
        
        weightDisplay.textContent = `${this.currentWeight} / ${this.currentMaxWeight}`;
        weightDisplay.style.color = percentage >= 1 ? '#ff0000' : 
                                   percentage >= 0.7 ? '#ffaa00' : '#00ff00';
    }
    
    failGame() {
        this.state = GameState.FAILED;
        this.playSound('break');
        this.createBreakParticles();
        
        setTimeout(() => {
            document.getElementById('failScreen').style.display = 'flex';
        }, 1000);
    }
    
    winGame() {
        this.state = GameState.WON;
        this.playSound('win');
        this.showWinScreen();
    }
    
    showWinScreen() {
        const winScreen = document.getElementById('winScreen');
        
        const totalWeight = this.caughtFish.reduce((sum, fish) => sum + fish.weight, 0);
        let title;
        if (totalWeight === 0) {
            title = '空军大佬，再接再厉！';
        } else if (totalWeight <= 10) {
            title = '小鱼见习生';
        } else if (totalWeight <= 30) {
            title = '浅海新手';
        } else if (totalWeight <= 80) {
            title = '船钓熟手';
        } else if (totalWeight <= 150) {
            title = '海钓达人';
        } else if (totalWeight <= 240) {
            title = '沧海钓王';
        } else {
            title = '拜见深海鱼神！';
        }
        winScreen.querySelector('h1').textContent = title;
        
        document.getElementById('maxDepth').textContent = `最大深度: ${Math.floor(this.maxDepthReached)} 米`;
        document.getElementById('fishCount').textContent = `钓起 ${this.caughtFish.length} 条鱼`;
        
        const fishDisplay = document.getElementById('fishDisplay');
        fishDisplay.innerHTML = '';
        
        const sortedFish = [...this.caughtFish].sort((a, b) => b.value - a.value);
        
        sortedFish.forEach(fish => {
            const fishItem = document.createElement('div');
            fishItem.className = 'fishItem';
            
            let isTreasureChest = fish.name === '宝箱';
            
            if (isTreasureChest) {
                fishItem.innerHTML = `
                    <div class="fishIcon"><img src="${fish.image}" alt="${fish.name}"></div>
                    <div class="fishName">${fish.name}</div>
                    <div class="fishValue">💰 ${fish.value}</div>
                `;
            } else {
                const fishImage = this.fishImages[fish.image];
                if (fishImage && fishImage.complete) {
                    fishItem.innerHTML = `
                        <div class="fishIcon"><img src="${fish.image}" alt="${fish.name}"></div>
                        <div class="fishName">${fish.name}</div>
                        <div class="fishValue">💰 ${fish.value}</div>
                    `;
                } else {
                    fishItem.innerHTML = `
                        <div class="fishIcon">${fish.emoji}</div>
                        <div class="fishName">${fish.name}</div>
                        <div class="fishValue">💰 ${fish.value}</div>
                    `;
                }
            }
            fishDisplay.appendChild(fishItem);
        });
        
        const totalValue = this.caughtFish.reduce((sum, fish) => sum + fish.value, 0);
        document.getElementById('totalValue').textContent = `总价值: ${totalValue} 💰`;
        
        winScreen.style.display = 'flex';
    }
    
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        this.drawBackground();
        this.drawDepthAxis();
        this.drawSeaBottom();
        this.drawFishes();
        this.drawTreasureChest();
        this.drawFishingLine();
        this.drawBoat();
        this.drawParticles();
        
        if (this.flashTimer > 0) {
            this.drawFlash();
        }
    }
    
    drawBackground() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        const depthProgress = Math.min(this.depth / MAX_DEPTH, 1);
        
        const topColor = this.lerpColor(
            { r: 135, g: 206, b: 250 },
            { r: 0, g: 51, b: 102 },
            depthProgress
        );
        const bottomColor = this.lerpColor(
            { r: 0, g: 102, b: 204 },
            { r: 0, g: 0, b: 51 },
            depthProgress
        );
        
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `rgb(${topColor.r}, ${topColor.g}, ${topColor.b})`);
        gradient.addColorStop(1, `rgb(${bottomColor.r}, ${bottomColor.g}, ${bottomColor.b})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        const seaScreenY = 0 - this.cameraY;
        
        if (seaScreenY > -100 && seaScreenY < height) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(0, seaScreenY, width, 60);
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = IS_MOBILE ? 1.5 : 2;
            ctx.beginPath();
            for (let x = 0; x < width; x += 10) {
                const y = seaScreenY + 55 + Math.sin(x * 0.02 + Date.now() * 0.001) * 4;
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
    }
    
    drawSeaBottom() {
        const ctx = this.ctx;
        
        const seaBottomWorldY = MAX_DEPTH * this.pixelsPerMeter;
        const seaBottomScreenY = seaBottomWorldY - this.cameraY;
        
        if (seaBottomScreenY > -100 && seaBottomScreenY < this.canvas.height + 100) {
            ctx.fillStyle = 'rgba(139, 90, 43, 1)';
            ctx.beginPath();
            ctx.moveTo(0, seaBottomScreenY);
            
            for (let x = 0; x <= this.canvas.width; x += 40) {
                const y = seaBottomScreenY + Math.sin(x * 0.01) * 8;
                ctx.lineTo(x, y);
            }
            
            ctx.lineTo(this.canvas.width, this.canvas.height);
            ctx.lineTo(0, this.canvas.height);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = 'rgba(34, 139, 34, 1)';
            const seaweedCount = Math.floor(this.canvas.width / 150);
            for (let i = 0; i < seaweedCount; i++) {
                const x = 75 + i * 150;
                const y = seaBottomScreenY + 8;
                this.drawSeaweed(ctx, x, y, 0.8);
            }
        }
    }
    
    drawSeaweed(ctx, x, y, alpha) {
        ctx.fillStyle = `rgba(34, 139, 34, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 15, y + 25, x, y + 50);
        ctx.quadraticCurveTo(x - 15, y + 75, x, y + 100);
        ctx.quadraticCurveTo(x + 8, y + 75, x + 4, y + 50);
        ctx.quadraticCurveTo(x + 12, y + 25, x + 8, y);
        ctx.closePath();
        ctx.fill();
    }
    
    drawFishes() {
        const ctx = this.ctx;
        const time = Date.now() / 1000;
        
        this.fishes.forEach(fish => {
            ctx.save();
            
            const fishImage = this.fishImages[fish.image];
            const scale = fish.mobileScale || 1;
            
            if (fish.caught) {
                let offsetY = fish.size * scale / 2;
                if (fishImage && fishImage.complete) {
                    offsetY = fishImage.height * scale / 2;
                }
                
                ctx.translate(this.hookX, this.getHookScreenY() + offsetY);
                ctx.rotate(Math.PI / 2);
                
                if (fishImage && fishImage.complete) {
                    ctx.drawImage(
                        fishImage,
                        -fishImage.width * scale / 2,
                        -fishImage.height * scale / 2,
                        fishImage.width * scale,
                        fishImage.height * scale
                    );
                } else {
                    ctx.font = `${fish.size * scale}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(fish.emoji, 0, 0);
                }
            } else {
                const fishScreenY = fish.worldY - this.cameraY;
                const size = fishImage ? Math.max(fishImage.width, fishImage.height) * scale : fish.size * scale;
                
                if (fishScreenY > -size && fishScreenY < this.canvas.height + size) {
                    const isFacingRight = fish.direction > 0;
                    
                    if (fishImage && fishImage.complete) {
                        const imgWidth = fishImage.width * scale;
                        const imgHeight = fishImage.height * scale;
                        
                        ctx.translate(fish.x, fishScreenY);
                        
                        // 鱼头朝向游动方向：GIF中鱼头在右侧
                        // 向右游时翻转使鱼头朝右，向左游时鱼头原本朝左
                        if (isFacingRight) {
                            ctx.scale(-1, 1);
                        }
                        
                        // 整体绘制图片，保持完整不裁剪
                        ctx.drawImage(
                            fishImage,
                            -imgWidth / 2,
                            -imgHeight / 2,
                            imgWidth,
                            imgHeight
                        );
                    } else {
                        ctx.translate(fish.x, fishScreenY);
                        ctx.font = `${fish.size * scale}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(fish.emoji, 0, 0);
                    }
                }
            }
            
            ctx.restore();
        });
    }
    
    drawTreasureChest() {
        if (!this.treasureChest) return;
        
        const ctx = this.ctx;
        const mobileScale = this.getMobileScale();
        
        if (this.treasureChest.caught) {
            const scale = this.treasureChest.mobileScale || 1;
            let offsetY = 30 * scale;
            if (this.chestImage && this.chestImage.complete) {
                offsetY = this.chestImage.height * scale / 2;
            }
            
            ctx.save();
            ctx.translate(this.hookX, this.getHookScreenY() + offsetY);
            ctx.rotate(Math.PI / 4);
            
            if (this.chestImage && this.chestImage.complete) {
                ctx.drawImage(
                    this.chestImage,
                    -this.chestImage.width * scale / 2,
                    -this.chestImage.height * scale / 2,
                    this.chestImage.width * scale,
                    this.chestImage.height * scale
                );
            } else {
                ctx.font = '40px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('📦', 0, 0);
            }
            ctx.restore();
        } else {
            const chestScreenY = this.treasureChest.worldY - this.cameraY;
            const scale = this.treasureChest.mobileScale || 1;
            const size = this.chestImage ? Math.max(this.chestImage.width, this.chestImage.height) * scale : 60;
            
            if (chestScreenY > -size && chestScreenY < this.canvas.height + size) {
                ctx.save();
                ctx.translate(this.treasureChest.x, chestScreenY);
                
                if (this.chestImage && this.chestImage.complete) {
                    ctx.drawImage(
                        this.chestImage,
                        -this.chestImage.width * scale / 2,
                        -this.chestImage.height * scale / 2,
                        this.chestImage.width * scale,
                        this.chestImage.height * scale
                    );
                } else {
                    ctx.font = '40px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('📦', 0, 0);
                }
                ctx.restore();
            }
        }
    }
    
    drawFishingLine() {
        const ctx = this.ctx;
        
        const seaScreenY = 0 - this.cameraY;
        const boatScreenY = seaScreenY + (IS_MOBILE ? 50 : 60);
        const hookScreenY = this.getHookScreenY();
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = IS_MOBILE ? 1.5 : 2;
        ctx.beginPath();
        ctx.moveTo(this.hookX, boatScreenY);
        ctx.lineTo(this.hookX, hookScreenY);
        ctx.stroke();
        
        const mobileScale = this.getMobileScale();
        if (this.hookImageLoaded && this.hookImage.complete) {
            const hookWidth = this.hookImage.width * mobileScale;
            const hookHeight = this.hookImage.height * mobileScale;
            ctx.drawImage(
                this.hookImage, 
                this.hookX - hookWidth / 2, 
                hookScreenY, 
                hookWidth, 
                hookHeight
            );
        } else {
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.hookX, hookScreenY);
            ctx.lineTo(this.hookX - 8, hookScreenY + 15);
            ctx.lineTo(this.hookX + 8, hookScreenY + 15);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(this.hookX - 8, hookScreenY + 10, 4, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    drawBoat() {
        const ctx = this.ctx;
        const boatX = this.hookX;
        
        const seaScreenY = 0 - this.cameraY;
        const boatScreenY = seaScreenY + (IS_MOBILE ? 50 : 60);
        const scale = IS_MOBILE ? 0.7 : 1;
        
        if (boatScreenY > -80 && boatScreenY < this.canvas.height + 80) {
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.moveTo(boatX - 30 * scale, boatScreenY);
            ctx.lineTo(boatX - 22 * scale, boatScreenY + 15 * scale);
            ctx.lineTo(boatX + 22 * scale, boatScreenY + 15 * scale);
            ctx.lineTo(boatX + 30 * scale, boatScreenY);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = '#A0522D';
            ctx.fillRect(boatX - 11 * scale, boatScreenY - 11 * scale, 22 * scale, 11 * scale);
            
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(boatX + 18 * scale, boatScreenY - 7 * scale);
            ctx.lineTo(boatX + 11 * scale, boatScreenY - 30 * scale);
            ctx.stroke();
        }
    }
    
    drawParticles() {
        const ctx = this.ctx;
        
        this.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.globalAlpha = 1;
    }
    
    drawFlash() {
        const ctx = this.ctx;
        ctx.fillStyle = `rgba(255, 0, 0, ${this.flashTimer * 2})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawDepthAxis() {
        const ctx = this.ctx;
        const axisX = IS_MOBILE ? 40 : 60;
        const smallTickWidth = IS_MOBILE ? 8 : 10;
        const bigTickWidth = IS_MOBILE ? 15 : 20;
        
        const topDepth = Math.floor(this.depth);
        const bottomDepth = Math.floor(this.depth + DEPTH_PER_SCREEN);
        const pixelsPerMeter = this.canvas.height / DEPTH_PER_SCREEN;
        
        ctx.save();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(axisX, 0);
        ctx.lineTo(axisX, this.canvas.height);
        ctx.stroke();
        
        const fontSize = IS_MOBILE ? 12 : 16;
        const smallFontSize = IS_MOBILE ? 10 : 12;
        
        for (let d = topDepth; d <= bottomDepth; d++) {
            if (d < 0 || d > MAX_DEPTH) continue;
            
            const screenY = (d - this.depth) * pixelsPerMeter;
            
            if (screenY < -20 || screenY > this.canvas.height + 20) continue;
            
            const isBigTick = d % 50 === 0;
            const isSmallTick = d % 10 === 0;
            
            if (isBigTick) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(axisX, screenY);
                ctx.lineTo(axisX + bigTickWidth, screenY);
                ctx.stroke();
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = `bold ${fontSize}px Arial`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${d}m`, axisX + bigTickWidth + 4, screenY);
            } else if (isSmallTick) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(axisX, screenY);
                ctx.lineTo(axisX + smallTickWidth, screenY);
                ctx.stroke();
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.font = `${smallFontSize}px Arial`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${d}`, axisX + smallTickWidth + 4, screenY);
            }
        }
        
        ctx.restore();
    }
    
    lerpColor(color1, color2, t) {
        return {
            r: Math.round(color1.r + (color2.r - color1.r) * t),
            g: Math.round(color1.g + (color2.g - color1.g) * t),
            b: Math.round(color1.b + (color2.b - color1.b) * t)
        };
    }
    
    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    
    playSound(type) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        if (type === 'warning') {
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200);
        } else if (type === 'catch') {
            oscillator.frequency.value = 600;
            oscillator.type = 'square';
            gainNode.gain.value = 0.2;
            oscillator.start();
            setTimeout(() => {
                oscillator.frequency.value = 800;
            }, 100);
            setTimeout(() => oscillator.stop(), 300);
        } else if (type === 'break') {
            oscillator.frequency.value = 200;
            oscillator.type = 'sawtooth';
            gainNode.gain.value = 0.4;
            oscillator.start();
            setTimeout(() => {
                oscillator.frequency.value = 50;
            }, 200);
            setTimeout(() => oscillator.stop(), 500);
        } else if (type === 'win') {
            oscillator.frequency.value = 523;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            oscillator.start();
            
            const notes = [523, 659, 784, 1047];
            notes.forEach((freq, i) => {
                setTimeout(() => {
                    oscillator.frequency.value = freq;
                }, i * 150);
            });
            setTimeout(() => oscillator.stop(), 600);
        }
    }
}

window.addEventListener('load', () => {
    new DeepSeaFishingGame();
});
