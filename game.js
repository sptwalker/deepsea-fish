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
    isSmallFish: true // 标记为小鱼
};

// 宝箱数据
const TREASURE_CHEST = {
    name: '宝箱',
    weight: 249,
    value: 4000,
    image: '宝箱.gif'
};

// 游戏常量
const MAX_DEPTH = 250; // 最大深度250米
const DEPTH_PER_SCREEN = 50; // 每个屏幕50米
const DESCEND_SPEED = 5; // 下降速度5米/秒
const ASCEND_SPEED = 10; // 上升速度10米/秒
const MAX_WEIGHT = 250; // 最大重量
const INITIAL_MAX_WEIGHT = 250; // 初始最大重量
const SCREEN_2_3_RATIO = 0.667; // 屏幕2/3位置
const MAX_COLLISIONS = 4; // 最大碰撞次数（4次后鱼线断裂）

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
        
        this.state = GameState.START;
        this.depth = 0;
        this.maxDepthReached = 0;
        this.hookX = this.canvas.width / 2;
        this.hookYOffset = 0; // 鱼钩垂直偏移（鼠标控制，单位像素）
        this.collisionCount = 0;
        this.currentWeight = 0;
        this.currentMaxWeight = INITIAL_MAX_WEIGHT; // 当前最大负重（会因碰撞而减少）
        this.caughtFish = [];
        this.flashTimer = 0;
        this.fishes = [];
        this.particles = [];
        this.lastTime = 0;
        
        // 宝箱
        this.treasureChest = null; // 当前游戏的宝箱对象
        this.chestImage = new Image();
        this.chestImage.src = TREASURE_CHEST.image;
        this.chestImageLoaded = false;
        this.chestImage.onload = () => {
            this.chestImageLoaded = true;
        };
        
        // 卷轴滚动相关
        this.cameraY = 0; // 相机Y位置（世界坐标）
        this.worldHeight = MAX_DEPTH * (this.canvas.height / DEPTH_PER_SCREEN); // 世界总高度
        this.pixelsPerMeter = this.canvas.height / DEPTH_PER_SCREEN; // 每米对应的像素
        
        // 海面Y位置（世界坐标）
        this.seaLevel = 0;
        // 海底Y位置（世界坐标）
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
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.pixelsPerMeter = this.canvas.height / DEPTH_PER_SCREEN;
    }
    
    loadFishImages() {
        const loadedCount = { count: 0 };
        const totalImages = FISH_TYPES.length + 1; // 包括小鱼
        
        // 加载其他鱼类图片
        FISH_TYPES.forEach(fishType => {
            const img = new Image();
            img.src = fishType.image;
            img.onload = () => {
                loadedCount.count++;
                if (loadedCount.count === totalImages) {
                    this.imagesLoaded = true;
                    console.log('所有鱼类图片加载完成');
                }
            };
            img.onerror = () => {
                console.error(`加载图片失败: ${fishType.image}`);
                loadedCount.count++;
            };
            this.fishImages[fishType.image] = img;
        });
        
        // 加载小鱼图片
        const smallFishImg = new Image();
        smallFishImg.src = SMALL_FISH.image;
        smallFishImg.onload = () => {
            loadedCount.count++;
            if (loadedCount.count === totalImages) {
                this.imagesLoaded = true;
                console.log('所有鱼类图片加载完成');
            }
        };
        smallFishImg.onerror = () => {
            console.error(`加载图片失败: ${SMALL_FISH.image}`);
            loadedCount.count++;
        };
        this.fishImages[SMALL_FISH.image] = smallFishImg;
    }
    
    bindEvents() {
        const gameContainer = document.getElementById('gameContainer');
        gameContainer.addEventListener('click', () => this.handleClick());
        
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        document.getElementById('retryBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.restart();
        });
        document.getElementById('playAgainBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.restart();
        });
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
    
    handleClick() {
        this.initAudio();
        
        if (this.state === GameState.START) {
            this.startGame();
        } else if (this.state === GameState.DESCENDING) {
            this.startAscending();
        }
    }
    
    handleMouseMove(e) {
        if (this.state === GameState.DESCENDING || this.state === GameState.ASCENDING) {
            this.hookX = e.clientX;
        }
        // 下降阶段：垂直方向在默认位置上下10米范围内跟随鼠标
        if (this.state === GameState.DESCENDING) {
            const defaultY = this.getDefaultHookScreenY();
            const maxOffset = 10 * this.pixelsPerMeter; // 10米对应像素
            this.hookYOffset = Math.max(-maxOffset, Math.min(maxOffset, e.clientY - defaultY));
        }
    }
    
    startGame() {
        this.state = GameState.DESCENDING;
        this.depth = 0;
        this.collisionCount = 0;
        this.caughtFish = [];
        this.fishes = [];
        this.particles = [];
        this.currentWeight = 0;
        this.currentMaxWeight = INITIAL_MAX_WEIGHT; // 重置最大负重
        
        // 隐藏开始界面
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('weightCounter').style.display = 'block'; // 下降阶段也显示负重计数器
        this.updateWeightDisplay();
        
        // 初始化鱼群
        this.generateFishes();
    }
    
    generateFishes() {
        this.fishes = [];

        // 根据屏幕分辨率计算密度系数（以2560x1600为参考，降低1/3）
        const refArea = 2560 * 1600;
        const currentArea = this.canvas.width * this.canvas.height;
        const densityFactor = (currentArea / refArea) * (2 / 3);

        // 生成小鱼（高密度，均匀分布在整个深度范围）
        const smallFishCount = Math.max(10, Math.floor((80 + Math.random() * 40) * densityFactor));
        for (let i = 0; i < smallFishCount; i++) {
            // 随机深度：0-250米均匀分布
            const randomDepth = Math.random() * MAX_DEPTH;
            
            // 计算鱼在世界坐标中的Y位置
            const worldY = randomDepth * this.pixelsPerMeter + this.canvas.height * 0.2 + 
                          Math.random() * (this.canvas.height * 0.6);
            
            // 小鱼的图片尺寸
            const smallFishImage = this.fishImages[SMALL_FISH.image];
            let collisionRadius = SMALL_FISH.size / 2;
            if (smallFishImage && smallFishImage.complete) {
                collisionRadius = Math.min(smallFishImage.width, smallFishImage.height) / 2;
            }
            
            const smallFish = {
                ...SMALL_FISH,
                x: Math.random() * this.canvas.width,
                worldY: worldY,
                speed: (1 + Math.random() * 2) * 1.3, // 速度比其他鱼类快30%
                direction: Math.random() > 0.5 ? 1 : -1,
                caught: false,
                hasCollided: false,
                collisionRadius: collisionRadius
            };
            
            this.fishes.push(smallFish);
        }
        
        // 生成其他鱼类（原有的逻辑）
        const otherFishCount = Math.max(8, Math.floor((50 + Math.random() * 30) * densityFactor));
        
        for (let i = 0; i < otherFishCount; i++) {
            let fishTypeIndex;
            
            // 根据深度决定鱼的种类
            const randomDepth = Math.random() * MAX_DEPTH;
            
            if (randomDepth < 50) {
                // 0-50米：小鱼
                fishTypeIndex = Math.floor(Math.random() * 3); // 蝴蝶鱼、小丑鱼、石斑鱼
            } else if (randomDepth < 100) {
                // 50-100米：中小鱼
                fishTypeIndex = Math.floor(Math.random() * 5); // 加上金枪鱼、剑鱼
            } else if (randomDepth < 150) {
                // 100-150米：中鱼
                fishTypeIndex = Math.floor(Math.random() * 7); // 加上马林鱼、翻车鱼
            } else if (randomDepth < 200) {
                // 150-200米：大鱼
                fishTypeIndex = Math.floor(Math.random() * 8); // 加上大白鲨
            } else {
                // 200-250米：最大鱼（包括鲸鲨和皇带鱼）
                fishTypeIndex = 8 + Math.floor(Math.random() * 2); // 鲸鲨、皇带鱼
            }
            
            const fishType = FISH_TYPES[fishTypeIndex];
            
            // 获取鱼的图片尺寸用于碰撞检测
            const fishImage = this.fishImages[fishType.image];
            let collisionRadius = fishType.size / 2; // 默认使用size的一半
            if (fishImage && fishImage.complete) {
                // 使用图片的实际尺寸计算碰撞半径（取宽高的平均值）
                collisionRadius = Math.min(fishImage.width, fishImage.height) / 2;
            }
            
            // 计算鱼在世界坐标中的Y位置
            const worldY = randomDepth * this.pixelsPerMeter + this.canvas.height * 0.2 + 
                          Math.random() * (this.canvas.height * 0.6);
            
            const fish = {
                ...fishType,
                x: Math.random() * this.canvas.width,
                worldY: worldY, // 世界坐标Y
                speed: 1 + Math.random() * 2,
                direction: Math.random() > 0.5 ? 1 : -1,
                caught: false,
                hasCollided: false,
                collisionRadius: collisionRadius // 使用实际图片尺寸的碰撞半径
            };
            
            this.fishes.push(fish);
        }
        
        // 生成宝箱（150米以下随机位置）
        this.generateTreasureChest();
    }
    
    generateTreasureChest() {
        // 随机深度：150-250米之间
        const randomDepth = 150 + Math.random() * 100;
        
        // 宝箱基础位置
        const baseX = Math.random() * (this.canvas.width - 100) + 50;
        const baseY = randomDepth * this.pixelsPerMeter + this.canvas.height * 0.3;
        
        this.treasureChest = {
            ...TREASURE_CHEST,
            x: baseX,
            baseX: baseX, // 基础X位置
            worldY: baseY,
            baseWorldY: baseY, // 基础Y位置
            caught: false,
            hasCollided: false,
            collisionRadius: 40 // 宝箱碰撞半径
        };
    }
    
    updateTreasureChest(dt) {
        if (!this.treasureChest || this.treasureChest.caught) return;
        
        const time = Date.now() / 1000;
        
        // 宝箱缓慢浮动（少于2米）
        // 上下浮动：±1米
        this.treasureChest.worldY = this.treasureChest.baseWorldY + 
            Math.sin(time * 0.5) * this.pixelsPerMeter;
        
        // 左右浮动：±1米
        this.treasureChest.x = this.treasureChest.baseX + 
            Math.sin(time * 0.3 + 1) * this.pixelsPerMeter;
    }
    
    startAscending() {
        if (this.state !== GameState.DESCENDING) return;
        
        this.state = GameState.ASCENDING;
        this.hookYOffset = 0; // 上升阶段锁定垂直位置
        this.maxDepthReached = this.depth;
        // 负重计数器已经在下降阶段显示了，这里不需要再显示
        this.updateWeightDisplay();
    }
    
    restart() {
        this.state = GameState.START;
        this.depth = 0;
        this.cameraY = 0;
        this.maxDepthReached = 0;
        this.hookX = this.canvas.width / 2;
        this.hookYOffset = 0; // 鱼钩垂直偏移（鼠标控制，单位像素）
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
        
        // 更新鱼群
        this.updateFishes(dt);
        
        // 更新宝箱
        this.updateTreasureChest(dt);
        
        // 更新粒子
        this.updateParticles(dt);
        
        // 更新闪烁计时器
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
        }
    }
    
    updateDescending(dt) {
        // 更新深度
        this.depth += DESCEND_SPEED * dt;
        
        // 更新相机位置（随深度下降）
        this.cameraY = this.depth * this.pixelsPerMeter;
        
        if (this.depth >= MAX_DEPTH) {
            this.startAscending();
            return;
        }
        
        // 检查碰撞
        this.checkCollisions();
        
        // 更新负重显示（显示当前最大负重）
        this.updateWeightDisplay();
        
        // 碰撞4次后鱼线断裂，直接失败
        if (this.collisionCount >= MAX_COLLISIONS) {
            this.failGame();
        }
    }
    
    updateAscending(dt) {
        // 更新深度（减少）
        this.depth -= ASCEND_SPEED * dt;
        
        // 更新相机位置（随深度上升）
        this.cameraY = this.depth * this.pixelsPerMeter;
        
        if (this.depth <= 0) {
            this.depth = 0;
            this.cameraY = 0;
            this.winGame();
            return;
        }
        
        // 检查是否超重（使用当前最大负重）
        if (this.currentWeight >= this.currentMaxWeight) {
            this.failGame();
        }
        
        // 检查碰撞（用于捕鱼）
        this.checkFishCatch();
        
        this.updateWeightDisplay();
    }
    
    updateFishes(dt) {
        this.fishes.forEach(fish => {
            if (fish.caught) {
                // 被钓住的鱼跟随钩子移动（位置在绘制时处理）
                // 不需要更新位置，因为它们会在drawFishes中根据钩子位置绘制
            } else {
                // 正常游动
                fish.x += fish.speed * fish.direction;
                
                // 获取图片宽度用于边界检测
                const fishImage = this.fishImages[fish.image];
                const width = (fishImage && fishImage.complete) ? fishImage.width : fish.size;
                
                // 边界检测
                if (fish.x < -width) {
                    fish.x = this.canvas.width + width;
                } else if (fish.x > this.canvas.width + width) {
                    fish.x = -width;
                }
            }
        });
    }
    
    updateParticles(dt) {
        this.particles = this.particles.filter(p => {
            p.x += p.vx * dt;
            // 粒子Y位置需要考虑相机滚动
            if (!p.worldY) {
                p.worldY = p.y + this.cameraY;
            }
            p.vy += 200 * dt; // 重力
            p.worldY += p.vy * dt;
            p.y = p.worldY - this.cameraY;
            p.life -= dt;
            return p.life > 0 && p.y > -100 && p.y < this.canvas.height + 100;
        });
    }
    
    checkCollisions() {
        const hookScreenY = this.getHookScreenY();
        
        // 检查与鱼的碰撞
        this.fishes.forEach(fish => {
            if (fish.caught || fish.hasCollided) return;
            
            // 计算鱼的屏幕Y位置
            const fishScreenY = fish.worldY - this.cameraY;
            
            // 只检测在屏幕可见范围内的鱼
            if (fishScreenY < 100 || fishScreenY > this.canvas.height - 50) return;
            
            // 计算碰撞距离
            const distance = Math.sqrt(
                Math.pow(this.hookX - fish.x, 2) +
                Math.pow(hookScreenY - fishScreenY, 2)
            );
            
            // 使用鱼钩图片的实际尺寸计算碰撞半径
            let hookCollisionRadius = 15; // 默认碰撞半径
            if (this.hookImageLoaded && this.hookImage.complete) {
                // 取鱼钩图片宽高的平均值作为碰撞半径
                hookCollisionRadius = Math.min(this.hookImage.width, this.hookImage.height) / 2;
            }
            
            // 使用collisionRadius而不是fish.size / 2
            if (distance < fish.collisionRadius + hookCollisionRadius) {
                this.collisionCount++;
                fish.hasCollided = true; // 标记该鱼已碰撞过，避免重复计数
                
                // 每次碰撞减少25%的最大负重
                this.currentMaxWeight = INITIAL_MAX_WEIGHT * (1 - this.collisionCount * 0.25);
                
                this.flashTimer = 0.2;
                this.playSound('warning');
                
                // 生成碰撞粒子
                this.createCollisionParticles(fish.x, fishScreenY);
                
                console.log(`碰撞次数: ${this.collisionCount}/${MAX_COLLISIONS}, 当前最大负重: ${this.currentMaxWeight}kg`);
            }
        });
        
        // 检查与宝箱的碰撞
        if (this.treasureChest && !this.treasureChest.hasCollided) {
            const chestScreenY = this.treasureChest.worldY - this.cameraY;
            
            // 只检测在屏幕可见范围内的宝箱
            if (chestScreenY > 100 && chestScreenY < this.canvas.height - 50) {
                const distance = Math.sqrt(
                    Math.pow(this.hookX - this.treasureChest.x, 2) +
                    Math.pow(hookScreenY - chestScreenY, 2)
                );
                
                let hookCollisionRadius = 15;
                if (this.hookImageLoaded && this.hookImage.complete) {
                    hookCollisionRadius = Math.min(this.hookImage.width, this.hookImage.height) / 2;
                }
                
                if (distance < this.treasureChest.collisionRadius + hookCollisionRadius) {
                    this.collisionCount++;
                    this.treasureChest.hasCollided = true;
                    
                    // 每次碰撞减少25%的最大负重
                    this.currentMaxWeight = INITIAL_MAX_WEIGHT * (1 - this.collisionCount * 0.25);
                    
                    this.flashTimer = 0.2;
                    this.playSound('warning');
                    
                    // 生成碰撞粒子
                    this.createCollisionParticles(this.treasureChest.x, chestScreenY);
                    
                    console.log(`碰撞宝箱，碰撞次数: ${this.collisionCount}/${MAX_COLLISIONS}, 当前最大负重: ${this.currentMaxWeight}kg`);
                }
            }
        }
    }
    
    checkFishCatch() {
        const hookScreenY = this.getHookScreenY();
        
        // 检查捕获鱼
        this.fishes.forEach(fish => {
            if (fish.caught) return;
            
            // 计算鱼的屏幕Y位置
            const fishScreenY = fish.worldY - this.cameraY;
            
            // 只检测在屏幕可见范围内的鱼
            if (fishScreenY < 100 || fishScreenY > this.canvas.height - 50) return;
            
            // 计算碰撞距离
            const distance = Math.sqrt(
                Math.pow(this.hookX - fish.x, 2) +
                Math.pow(hookScreenY - fishScreenY, 2)
            );
            
            // 使用鱼钩图片的实际尺寸计算碰撞半径
            let hookCollisionRadius = 15; // 默认碰撞半径
            if (this.hookImageLoaded && this.hookImage.complete) {
                // 取鱼钩图片宽高的平均值作为碰撞半径
                hookCollisionRadius = Math.min(this.hookImage.width, this.hookImage.height) / 2;
            }
            
            // 使用collisionRadius而不是fish.size / 2
            if (distance < fish.collisionRadius + hookCollisionRadius) {
                fish.caught = true;
                this.caughtFish.push(fish);
                this.currentWeight += fish.weight;
                this.playSound('catch');
                
                // 生成捕捉粒子
                this.createCatchParticles(fish.x, fishScreenY);
            }
        });
        
        // 检查捕获宝箱
        if (this.treasureChest && !this.treasureChest.caught) {
            const chestScreenY = this.treasureChest.worldY - this.cameraY;
            
            // 只检测在屏幕可见范围内的宝箱
            if (chestScreenY > 100 && chestScreenY < this.canvas.height - 50) {
                const distance = Math.sqrt(
                    Math.pow(this.hookX - this.treasureChest.x, 2) +
                    Math.pow(hookScreenY - chestScreenY, 2)
                );
                
                let hookCollisionRadius = 15;
                if (this.hookImageLoaded && this.hookImage.complete) {
                    hookCollisionRadius = Math.min(this.hookImage.width, this.hookImage.height) / 2;
                }
                
                if (distance < this.treasureChest.collisionRadius + hookCollisionRadius) {
                    // 钓起宝箱
                    this.treasureChest.caught = true;
                    this.caughtFish.push(this.treasureChest);
                    this.currentWeight = 249; // 钓起宝箱后负重改为249kg
                    this.playSound('catch');
                    
                    // 生成捕捉粒子
                    this.createCatchParticles(this.treasureChest.x, chestScreenY);
                    
                    console.log('钓起宝箱！负重改为249kg');
                    
                    // 立即更新负重显示
                    this.updateWeightDisplay();
                }
            }
        }
    }
    
    createCollisionParticles(x, y) {
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                life: 0.5,
                color: '#ff0000',
                size: 3 + Math.random() * 3
            });
        }
    }
    
    createCatchParticles(x, y) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 150,
                vy: (Math.random() - 0.5) * 150 - 100,
                life: 0.7,
                color: '#00ff00',
                size: 2 + Math.random() * 4
            });
        }
    }
    
    createBreakParticles() {
        const hookScreenY = this.getHookScreenY();
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: this.hookX,
                y: hookScreenY,
                vx: (Math.random() - 0.5) * 400,
                vy: (Math.random() - 0.5) * 400,
                life: 1,
                color: '#ffaa00',
                size: 3 + Math.random() * 5
            });
        }
    }
    
    // 获取鱼钩默认在屏幕上的Y位置（不含鼠标偏移）
    getDefaultHookScreenY() {
        const twoThirdsY = this.canvas.height * SCREEN_2_3_RATIO;
        
        // 鱼钩初始在Y=150，随着深度增加到2/3位置后固定
        const initialY = 150;
        const maxVisibleDepth = DEPTH_PER_SCREEN;
        const progress = Math.min(this.depth, maxVisibleDepth) / maxVisibleDepth;
        
        return initialY + progress * (twoThirdsY - initialY);
    }
    
    // 获取鱼钩在屏幕上的实际Y位置（含鼠标偏移）
    getHookScreenY() {
        return this.getDefaultHookScreenY() + this.hookYOffset;
    }
    
    // 获取鱼钩在世界坐标中的Y位置
    getHookWorldY() {
        return this.cameraY + this.getHookScreenY();
    }
    
    updateWeightDisplay() {
        const weightDisplay = document.getElementById('weightValue');
        const weightIcon = document.getElementById('weightIcon');
        
        // 使用当前最大负重（会因碰撞而减少）
        const percentage = Math.min(this.currentWeight / this.currentMaxWeight, 1);
        
        // 计算图标高度：基于当前最大负重与初始最大负重的比例
        // 初始高度300px，碰撞后按比例减少
        const maxPercentage = this.currentMaxWeight / INITIAL_MAX_WEIGHT;
        const iconHeight = 300 * maxPercentage;
        
        weightDisplay.textContent = `${this.currentWeight} / ${this.currentMaxWeight}`;
        weightDisplay.style.color = percentage >= 1 ? '#ff0000' : 
                                   percentage >= 0.7 ? '#ffaa00' : '#00ff00';
        
        // 更新图标高度
        weightIcon.style.setProperty('--icon-height', `${iconHeight}px`);
        
        // 使用遮罩遮住顶部，露出底部渐变部分
        // 负重100%时mask-height为0%（露出全部），负重0%时mask-height为100%（遮住全部）
        weightIcon.style.setProperty('--mask-height', `${(1 - percentage) * 100}%`);
    }
    
    failGame() {
        this.state = GameState.FAILED;
        this.playSound('break');
        this.createBreakParticles();
        
        setTimeout(() => {
            document.getElementById('failScreen').style.display = 'flex';
        }, 1500);
    }
    
    winGame() {
        this.state = GameState.WON;
        this.playSound('win');
        
        // 显示结算界面
        this.showWinScreen();
    }
    
    showWinScreen() {
        const winScreen = document.getElementById('winScreen');
        
        // 根据钓到的总重量显示称号
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
        
        // 显示最大深度
        document.getElementById('maxDepth').textContent = 
            `最大深度: ${Math.floor(this.maxDepthReached)} 米`;
        
        // 显示鱼的数量
        document.getElementById('fishCount').textContent = 
            `钓起 ${this.caughtFish.length} 条鱼`;
        
        // 显示鱼列表（按价值从大到小排序）
        const fishDisplay = document.getElementById('fishDisplay');
        fishDisplay.innerHTML = '';
        
        const sortedFish = [...this.caughtFish].sort((a, b) => b.value - a.value);
        
        sortedFish.forEach(fish => {
            const fishItem = document.createElement('div');
            fishItem.className = 'fishItem';
            
            // 尝试使用图片，如果没有则使用emoji
            let fishImage = this.fishImages[fish.image];
            let isTreasureChest = fish.name === '宝箱';
            
            if (isTreasureChest) {
                // 宝箱使用chestImage
                fishItem.innerHTML = `
                    <div class="fishIcon"><img src="${fish.image}" alt="${fish.name}" style="width: 50px; height: 50px;"></div>
                    <div class="fishName">${fish.name}</div>
                    <div class="fishValue">💰 ${fish.value}</div>
                `;
            } else if (fishImage && fishImage.complete) {
                fishItem.innerHTML = `
                    <div class="fishIcon"><img src="${fish.image}" alt="${fish.name}" style="width: 50px; height: 50px;"></div>
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
            fishDisplay.appendChild(fishItem);
        });
        
        // 显示总价值
        const totalValue = this.caughtFish.reduce((sum, fish) => sum + fish.value, 0);
        document.getElementById('totalValue').textContent = 
            `总价值: ${totalValue} 💰`;
        
        winScreen.style.display = 'flex';
    }
    
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // 清空画布
        ctx.clearRect(0, 0, width, height);
        
        // 绘制背景
        this.drawBackground();
        
        // 绘制深度坐标轴
        this.drawDepthAxis();
        
        // 绘制海底
        this.drawSeaBottom();
        
        // 绘制鱼群
        this.drawFishes();
        
        // 绘制宝箱
        this.drawTreasureChest();
        
        // 绘制钓鱼线和钩子
        this.drawFishingLine();
        
        // 绘制小船
        this.drawBoat();
        
        // 绘制粒子
        this.drawParticles();
        
        // 绘制闪烁效果
        if (this.flashTimer > 0) {
            this.drawFlash();
        }
    }
    
    drawBackground() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // 根据深度计算颜色深度
        const depthProgress = Math.min(this.depth / MAX_DEPTH, 1);
        
        // 从浅蓝到深蓝的渐变
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
        
        // 绘制海面（海面会随着相机移动）
        const seaScreenY = 0 - this.cameraY; // 海面在屏幕上的Y位置
        
        // 只有海面在屏幕内时才绘制
        if (seaScreenY > -100 && seaScreenY < height) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(0, seaScreenY, width, 80);
            
            // 绘制波浪效果
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let x = 0; x < width; x += 10) {
                const y = seaScreenY + 75 + Math.sin(x * 0.02 + Date.now() * 0.001) * 5;
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
        const width = this.canvas.height;
        
        // 海底在世界坐标中的Y位置
        const seaBottomWorldY = MAX_DEPTH * this.pixelsPerMeter;
        // 海底在屏幕上的Y位置
        const seaBottomScreenY = seaBottomWorldY - this.cameraY;
        
        // 只有海底在屏幕内时才绘制
        if (seaBottomScreenY > -100 && seaBottomScreenY < this.canvas.height + 100) {
            ctx.fillStyle = 'rgba(139, 90, 43, 1)';
            ctx.beginPath();
            ctx.moveTo(0, seaBottomScreenY);
            
            for (let x = 0; x <= this.canvas.width; x += 50) {
                const y = seaBottomScreenY + Math.sin(x * 0.01) * 10;
                ctx.lineTo(x, y);
            }
            
            ctx.lineTo(this.canvas.width, this.canvas.height);
            ctx.lineTo(0, this.canvas.height);
            ctx.closePath();
            ctx.fill();
            
            // 绘制一些海底装饰
            ctx.fillStyle = 'rgba(34, 139, 34, 1)';
            for (let i = 0; i < 5; i++) {
                const x = 100 + i * 200;
                const y = seaBottomScreenY + 10;
                this.drawSeaweed(ctx, x, y, 1);
            }
        }
    }
    
    drawSeaweed(ctx, x, y, alpha) {
        ctx.fillStyle = `rgba(34, 139, 34, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(
            x + 20, y + 30,
            x, y + 60
        );
        ctx.quadraticCurveTo(
            x - 20, y + 90,
            x, y + 120
        );
        ctx.quadraticCurveTo(
            x + 10, y + 90,
            x + 5, y + 60
        );
        ctx.quadraticCurveTo(
            x + 15, y + 30,
            x + 10, y
        );
        ctx.closePath();
        ctx.fill();
    }
    
    drawFishes() {
        const ctx = this.ctx;
        const time = Date.now() / 1000; // 当前时间（秒）
        
        this.fishes.forEach(fish => {
            ctx.save();
            
            // 获取鱼的图片
            const fishImage = this.fishImages[fish.image];
            
            if (fish.caught) {
                // 被钓住的鱼竖直悬挂在钩子上
                const fishImage = this.fishImages[fish.image];
                const offsetY = (fishImage && fishImage.complete) ? fishImage.height / 2 : fish.size / 2;
                
                ctx.translate(this.hookX, this.getHookScreenY() + offsetY);
                ctx.rotate(Math.PI / 2); // 旋转90度，使鱼竖直
                
                if (fishImage && fishImage.complete) {
                    // 使用图片原始尺寸，不压缩
                    ctx.drawImage(fishImage, -fishImage.width / 2, -fishImage.height / 2, fishImage.width, fishImage.height);
                } else {
                    // 图片未加载完成时使用emoji作为后备
                    ctx.font = `${fish.size}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(fish.emoji, 0, 0);
                }
            } else {
                // 计算鱼的屏幕Y位置（世界坐标 - 相机位置）
                const fishScreenY = fish.worldY - this.cameraY;
                
                // 获取图片尺寸用于可见范围检测
                const fishImage = this.fishImages[fish.image];
                const size = (fishImage && fishImage.complete) ? Math.max(fishImage.width, fishImage.height) : fish.size;
                
                // 只绘制在屏幕可见范围内的鱼
                if (fishScreenY > -size && fishScreenY < this.canvas.height + size) {
                    const isFacingRight = fish.direction > 0;
                    
                    if (fishImage && fishImage.complete) {
                        const imgWidth = fishImage.width;
                        const imgHeight = fishImage.height;
                        
                        // 计算鱼身和鱼尾的分界点
                        const tailWidth = imgWidth * 0.3;
                        const bodyWidth = imgWidth - tailWidth;
                        
                        ctx.translate(fish.x, fishScreenY);
                        
                        // 根据游动方向决定是否镜像翻转
                        if (isFacingRight) {
                            // 向右游动：鱼头在右侧，需要水平翻转
                            ctx.scale(-1, 1);
                        }
                        
                        // 绘制鱼身（不摆动），多绘制1像素以覆盖缝隙
                        ctx.drawImage(
                            fishImage,
                            0, 0, bodyWidth + 1, imgHeight, // 源图像裁剪：鱼身部分（从左开始，多1像素）
                            -imgWidth / 2, // 目标X：居中偏左，鱼身从左侧开始
                            -imgHeight / 2, // 目标Y
                            bodyWidth + 1, imgHeight // 目标尺寸
                        );
                        
                        // 再绘制鱼尾（摆动）
                        ctx.save();
                        
                        // 移动到鱼尾连接点（鱼身右侧的连接处）
                        const tailConnectX = -imgWidth / 2 + bodyWidth;
                        ctx.translate(tailConnectX, 0);
                        
                        // 使用扭曲变形（skew）来制造摆动效果，而不是旋转
                        // skewX参数控制水平扭曲，使鱼尾看起来在摆动
                        const tailWag = Math.sin(time * 0.003 + fish.x * 0.01) * 0.3;
                        ctx.transform(1, tailWag, 0, 1, 0, 0); // 使用transform进行水平扭曲
                        
                        // 绘制鱼尾部分，从原位置开始绘制以重叠1像素
                        ctx.drawImage(
                            fishImage,
                            bodyWidth - 1, 0, tailWidth, imgHeight, // 源图像裁剪：鱼尾部分（从左侧多1像素）
                            -1, -imgHeight / 2, // 目标位置（相对于旋转中心，向左偏移1像素）
                            tailWidth, imgHeight // 目标尺寸
                        );
                        
                        ctx.restore();
                        
                    } else {
                        // 图片未加载完成时使用emoji作为后备
                        ctx.translate(fish.x, fishScreenY);
                        ctx.font = `${fish.size}px Arial`;
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
        
        if (this.treasureChest.caught) {
            // 被钓起的宝箱悬挂在钩子上，倾斜45度
            const offsetY = (this.chestImage && this.chestImage.complete) ? this.chestImage.height / 2 : 40;
            
            ctx.save();
            ctx.translate(this.hookX, this.getHookScreenY() + offsetY);
            ctx.rotate(Math.PI / 4); // 旋转45度
            
            if (this.chestImage && this.chestImage.complete) {
                ctx.drawImage(this.chestImage, -this.chestImage.width / 2, -this.chestImage.height / 2, this.chestImage.width, this.chestImage.height);
            } else {
                // 图片未加载完成时使用emoji作为后备
                ctx.font = '60px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('📦', 0, 0);
            }
            ctx.restore();
        } else {
            // 自由浮动的宝箱
            const chestScreenY = this.treasureChest.worldY - this.cameraY;
            
            // 只绘制在屏幕可见范围内的宝箱
            const size = (this.chestImage && this.chestImage.complete) ? Math.max(this.chestImage.width, this.chestImage.height) : 80;
            if (chestScreenY > -size && chestScreenY < this.canvas.height + size) {
                ctx.save();
                ctx.translate(this.treasureChest.x, chestScreenY);
                
                if (this.chestImage && this.chestImage.complete) {
                    ctx.drawImage(this.chestImage, -this.chestImage.width / 2, -this.chestImage.height / 2, this.chestImage.width, this.chestImage.height);
                } else {
                    // 图片未加载完成时使用emoji作为后备
                    ctx.font = '60px Arial';
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
        
        // 计算海面在屏幕上的位置
        const seaScreenY = 0 - this.cameraY;
        
        // 小船在海面上的位置（固定）
        const boatScreenY = seaScreenY + 60;
        const hookScreenY = this.getHookScreenY();
        
        // 绘制钓线（从船到钩子）
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.hookX, boatScreenY);
        ctx.lineTo(this.hookX, hookScreenY);
        ctx.stroke();
        
        // 绘制鱼钩图片
        if (this.hookImageLoaded && this.hookImage.complete) {
            ctx.drawImage(
                this.hookImage, 
                this.hookX - this.hookImage.width / 2, 
                hookScreenY, 
                this.hookImage.width, 
                this.hookImage.height
            );
        } else {
            // 备用方案：绘制简单钩子
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.hookX, hookScreenY);
            ctx.lineTo(this.hookX - 10, hookScreenY + 20);
            ctx.lineTo(this.hookX + 10, hookScreenY + 20);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(this.hookX - 10, hookScreenY + 15, 5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    drawBoat() {
        const ctx = this.ctx;
        const boatX = this.hookX;
        
        // 计算海面在屏幕上的位置
        const seaScreenY = 0 - this.cameraY;
        
        // 小船在海面上的位置（会随着相机移动）
        const boatScreenY = seaScreenY + 60;
        
        // 只有小船在屏幕内时才绘制
        if (boatScreenY > -100 && boatScreenY < this.canvas.height + 100) {
            // 船身
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.moveTo(boatX - 40, boatScreenY);
            ctx.lineTo(boatX - 30, boatScreenY + 20);
            ctx.lineTo(boatX + 30, boatScreenY + 20);
            ctx.lineTo(boatX + 40, boatScreenY);
            ctx.closePath();
            ctx.fill();
            
            // 船舱
            ctx.fillStyle = '#A0522D';
            ctx.fillRect(boatX - 15, boatScreenY - 15, 30, 15);
            
            // 渔竿
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(boatX + 25, boatScreenY - 10);
            ctx.lineTo(boatX + 15, boatScreenY - 40);
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
        const axisX = 60; // 坐标轴X位置
        const smallTickWidth = 10; // 小刻度宽度
        const bigTickWidth = 20; // 大刻度宽度
        
        // 计算当前屏幕显示的深度范围
        const topDepth = Math.floor(this.depth);
        const bottomDepth = Math.floor(this.depth + DEPTH_PER_SCREEN);
        
        // 计算每10米对应的屏幕像素高度
        const pixelsPerMeter = this.canvas.height / DEPTH_PER_SCREEN;
        
        ctx.save();
        
        // 绘制坐标轴主线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(axisX, 0);
        ctx.lineTo(axisX, this.canvas.height);
        ctx.stroke();
        
        // 绘制刻度和数字
        for (let d = topDepth; d <= bottomDepth; d++) {
            if (d < 0 || d > MAX_DEPTH) continue;
            
            // 计算该深度在屏幕上的Y位置
            // depth * pixelsPerMeter 是世界坐标Y
            // screenY = worldY - cameraY = d * pixelsPerMeter - depth * pixelsPerMeter
            const screenY = (d - this.depth) * pixelsPerMeter;
            
            if (screenY < -20 || screenY > this.canvas.height + 20) continue;
            
            // 判断是大刻度（50米）还是小刻度（10米）
            const isBigTick = d % 50 === 0;
            const isSmallTick = d % 10 === 0;
            
            if (isBigTick) {
                // 大刻度：长线 + 大数字
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(axisX, screenY);
                ctx.lineTo(axisX + bigTickWidth, screenY);
                ctx.stroke();
                
                // 大数字
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${d}m`, axisX + bigTickWidth + 5, screenY);
            } else if (isSmallTick) {
                // 小刻度：短线 + 小数字
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(axisX, screenY);
                ctx.lineTo(axisX + smallTickWidth, screenY);
                ctx.stroke();
                
                // 小数字
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.font = '12px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${d}`, axisX + smallTickWidth + 5, screenY);
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
}

// 初始化游戏
window.addEventListener('load', () => {
    new DeepSeaFishingGame();
});
