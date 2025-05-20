document.addEventListener('DOMContentLoaded', function() {
    // Проверка аутентификации и обновление навигации
    checkAuth();
    
    // Обработчики форм
    if (document.getElementById('registerForm')) {
        setupRegisterForm();
    }
    
    if (document.getElementById('loginForm')) {
        setupLoginForm();
    }
    
    if (document.getElementById('cardForm')) {
        setupCardForm();
    }
    
    // Обработчики для страницы карточек
    if (document.querySelector('.user-cards')) {
        setupUserCards();
    }
    
    // Обработчики для админпанели
    if (document.querySelector('.admin-panel')) {
        setupAdminPanel();
    }
});

// Проверка аутентификации
function checkAuth() {
    fetch('/api/user')
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Не авторизован');
        })
        .then(user => {
            updateNav(true, false);
            
            // Проверка на администратора
            return fetch('/api/admin/cards');
        })
        .then(response => {
            if (response.ok) {
                updateNav(true, true);
            }
        })
        .catch(() => {
            updateNav(false, false);
        });
}

// Обновление навигации
function updateNav(isAuth, isAdmin) {
    const authLink = document.getElementById('auth-link');
    const registerLink = document.getElementById('register-link');
    const cardsLink = document.getElementById('cards-link');
    const createCardLink = document.getElementById('create-card-link');
    const adminLink = document.getElementById('admin-link');
    const logoutLink = document.getElementById('logout-link');
    
    if (isAuth) {
        if (authLink) authLink.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
        if (cardsLink) cardsLink.style.display = 'inline-block';
        if (createCardLink) createCardLink.style.display = 'inline-block';
        if (logoutLink) logoutLink.style.display = 'inline-block';
        
        if (isAdmin && adminLink) {
            adminLink.style.display = 'inline-block';
        }
    } else {
        if (authLink) authLink.style.display = 'inline-block';
        if (registerLink) registerLink.style.display = 'inline-block';
        if (cardsLink) cardsLink.style.display = 'none';
        if (createCardLink) createCardLink.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'none';
    }
}

// Регистрация
function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    const errorDiv = document.getElementById('registerError');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            fullName: form.fullName.value,
            phone: form.phone.value,
            email: form.email.value,
            login: form.login.value,
            password: form.password.value
        };
        
        fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            window.location.href = '/cards';
        })
        .catch(error => {
            errorDiv.textContent = error.error || 'Ошибка при регистрации';
        });
    });
}

// Авторизация
function setupLoginForm() {
    const form = document.getElementById('loginForm');
    const errorDiv = document.getElementById('authError');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            login: form.login.value,
            password: form.password.value
        };
        
        fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            if (data.isAdmin) {
                window.location.href = '/admin';
            } else {
                window.location.href = '/cards';
            }
        })
        .catch(error => {
            errorDiv.textContent = error.error || 'Ошибка при авторизации';
        });
    });
}

// Создание карточки
function setupCardForm() {
    const form = document.getElementById('cardForm');
    const errorDiv = document.getElementById('cardError');
    const successDiv = document.getElementById('cardSuccess');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            author: form.author.value,
            title: form.title.value,
            type: form.type.value
        };
        
        fetch('/api/cards', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            successDiv.textContent = 'Карточка успешно создана и отправлена на модерацию!';
            form.reset();
            setTimeout(() => {
                successDiv.textContent = '';
            }, 3000);
        })
        .catch(error => {
            errorDiv.textContent = error.error || 'Ошибка при создании карточки';
        });
    });
}

// Управление карточками пользователя
function setupUserCards() {
    const tabs = document.querySelectorAll('.tab-btn');
    const cardsContainer = document.getElementById('cardsContainer');
    
    // Обработчики вкладок
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            loadUserCards(this.dataset.tab);
        });
    });
    
    // Загрузка карточек по умолчанию
    loadUserCards('active');
}

function loadUserCards(status) {
    const cardsContainer = document.getElementById('cardsContainer');
    cardsContainer.innerHTML = '<p>Загрузка...</p>';
    
    fetch(`/api/cards?status=${status}`)
        .then(response => response.json())
        .then(cards => {
            if (cards.length === 0) {
                cardsContainer.innerHTML = '<p>Нет карточек</p>';
                return;
            }
            
            cardsContainer.innerHTML = '';
            cards.forEach(card => {
                const cardElement = createCardElement(card);
                cardsContainer.appendChild(cardElement);
            });
        })
        .catch(() => {
            cardsContainer.innerHTML = '<p>Ошибка при загрузке карточек</p>';
        });
}

function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    
    const statusClass = `status-${card.status}`;
    
    cardDiv.innerHTML = `
        <h3>${card.title}</h3>
        <p><strong>Автор:</strong> ${card.author}</p>
        <p><strong>Тип:</strong> ${card.type === 'share' ? 'Готов поделиться' : 'Хочу в библиотеку'}</p>
        <span class="status ${statusClass}">${
            card.status === 'pending' ? 'На рассмотрении' : 
            card.status === 'approved' ? 'Одобрено' : 'Отклонено'
        }</span>
    `;
    
    if (card.status === 'rejected' && card.rejection_reason) {
        cardDiv.innerHTML += `
            <div class="rejection-reason">
                <strong>Причина отклонения:</strong> ${card.rejection_reason}
            </div>
        `;
    }
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';
    
    if (card.status !== 'archived') {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Удалить';
        deleteBtn.addEventListener('click', () => deleteCard(card.id));
        actionsDiv.appendChild(deleteBtn);
    }
    
    cardDiv.appendChild(actionsDiv);
    
    return cardDiv;
}

function deleteCard(cardId) {
    if (!confirm('Вы уверены, что хотите удалить эту карточку?')) return;
    
    fetch(`/api/cards/${cardId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Ошибка при удалении');
        }
        return response.json();
    })
    .then(() => {
        const activeTab = document.querySelector('.tab-btn.active');
        loadUserCards(activeTab.dataset.tab);
    })
    .catch(error => {
        alert(error.message);
    });
}

// Админпанель
function setupAdminPanel() {
    const tabs = document.querySelectorAll('.tab-btn');
    const cardsContainer = document.getElementById('adminCardsContainer');
    
    // Обработчики вкладок
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            loadAdminCards(this.dataset.tab);
        });
    });
    
    // Загрузка карточек по умолчанию
    loadAdminCards('pending');
}

function loadAdminCards(status) {
    const cardsContainer = document.getElementById('adminCardsContainer');
    cardsContainer.innerHTML = '<p>Загрузка...</p>';
    
    fetch(`/api/admin/cards?status=${status}`)
        .then(response => response.json())
        .then(cards => {
            if (cards.length === 0) {
                cardsContainer.innerHTML = '<p>Нет карточек</p>';
                return;
            }
            
            cardsContainer.innerHTML = '';
            cards.forEach(card => {
                const cardElement = createAdminCardElement(card);
                cardsContainer.appendChild(cardElement);
            });
        })
        .catch(() => {
            cardsContainer.innerHTML = '<p>Ошибка при загрузке карточек</p>';
        });
}

function createAdminCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    
    const statusClass = `status-${card.status}`;
    
    cardDiv.innerHTML = `
        <h3>${card.title}</h3>
        <p><strong>Автор:</strong> ${card.author}</p>
        <p><strong>Тип:</strong> ${card.type === 'share' ? 'Готов поделиться' : 'Хочу в библиотеку'}</p>
        <p><strong>Пользователь:</strong> ${card.full_name} (${card.email})</p>
        <span class="status ${statusClass}">${
            card.status === 'pending' ? 'На рассмотрении' : 
            card.status === 'approved' ? 'Одобрено' : 'Отклонено'
        }</span>
    `;
    
    if (card.status === 'rejected' && card.rejection_reason) {
        cardDiv.innerHTML += `
            <div class="rejection-reason">
                <strong>Причина отклонения:</strong> ${card.rejection_reason}
            </div>
        `;
    }
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';
    
    if (card.status === 'pending') {
        const approveBtn = document.createElement('button');
        approveBtn.className = 'approve-btn';
        approveBtn.textContent = 'Одобрить';
        approveBtn.addEventListener('click', () => updateCardStatus(card.id, 'approved', ''));
        actionsDiv.appendChild(approveBtn);
        
        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'reject-btn';
        rejectBtn.textContent = 'Отклонить';
        rejectBtn.addEventListener('click', () => {
            const reason = prompt('Укажите причину отклонения:');
            if (reason) {
                updateCardStatus(card.id, 'rejected', reason);
            }
        });
        actionsDiv.appendChild(rejectBtn);
    }
    
    cardDiv.appendChild(actionsDiv);
    
    return cardDiv;
}

function updateCardStatus(cardId, status, rejectionReason) {
    fetch(`/api/admin/cards/${cardId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            status,
            rejection_reason: rejectionReason
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Ошибка при обновлении статуса');
        }
        return response.json();
    })
    .then(() => {
        const activeTab = document.querySelector('.tab-btn.active');
        loadAdminCards(activeTab.dataset.tab);
    })
    .catch(error => {
        alert(error.message);
    });
}