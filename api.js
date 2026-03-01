const API_BASE_URL = 'http://192.168.179.20:5005/api';

export const apiService = {
  // Test de connexion
  async testConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/frontend/test`);
      return await response.json();
    } catch (error) {
      console.error('Erreur de connexion à l\'API:', error);
      throw error;
    }
  },

  // Actions
  async getActions() {
    try {
      const response = await fetch(`${API_BASE_URL}/frontend/actions`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur lors du chargement des actions:', error);
      throw error;
    }
  },

  // Causes (pour le dashboard admin)
  async getCausesAdmin() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/causes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur lors du chargement des causes (admin):', error);
      throw error;
    }
  },

  async getCauseById(id) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/causes/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur lors du chargement de la cause:', error);
      throw error;
    }
  },

  async createCause(formData) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/causes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Note: Pas de Content-Type pour FormData, le navigateur le définit automatiquement
        },
        body: formData
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur lors de la création de la cause:', error);
      throw error;
    }
  },

  async updateCause(id, formData) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/causes/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la cause:', error);
      throw error;
    }
  },

  async deleteCause(id) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/causes/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur lors de la suppression de la cause:', error);
      throw error;
    }
  },

  async updateCauseOrder(id, direction) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/causes/${id}/order`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ direction })
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'ordre:', error);
      throw error;
    }
  },

  // FAQ
  async getFAQ() {
    try {
      const response = await fetch(`${API_BASE_URL}/frontend/faq`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur lors du chargement des FAQ:', error);
      throw error;
    }
  },

  // Témoignages
  async getTestimonials() {
    try {
      const response = await fetch(`${API_BASE_URL}/frontend/temoignages`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur lors du chargement des témoignages:', error);
      throw error;
    }
  },

  // Statistiques d'impact
  async getImpactStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/frontend/statistiques`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      throw error;
    }
  },

  // Données de transparence
  async getTransparencyData() {
    try {
      const response = await fetch(`${API_BASE_URL}/frontend/transparence`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur lors du chargement des données de transparence:', error);
      throw error;
    }
  },

  // Fonction générique pour les requêtes
  async fetchData(endpoint) {
    try {
      const response = await fetch(`${API_BASE_URL}/${endpoint}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Erreur lors du chargement de ${endpoint}:`, error);
      throw error;
    }
  },

  async getMedias() {
    try {
      const response = await fetch(`${API_BASE_URL}/frontend/medias`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur lors du chargement des médias:', error);
      throw error;
    }
  },

  // Upload depuis l'appareil
  async uploadFromDevice(formData) {
    try {
      const response = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur upload:', error);
      throw error;
    }
  },

  // Upload via URL
  async uploadFromUrl(data) {
    try {
      const response = await fetch(`${API_BASE_URL}/media/url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur upload URL:', error);
      throw error;
    }
  },

  // Récupérer tous les médias
  async getAllMedias(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE_URL}/media/all?${query}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur récupération médias:', error);
      throw error;
    }
  },

  // Supprimer un média
  async deleteMedia(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/medias/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur suppression média:', error);
      throw error;
    }
  },

  // ===== MÉTHODES POUR LE BANNER =====

  // Récupérer les slides pour le frontend
  async getBannerSlides() {
    try {
      const response = await fetch(`${API_BASE_URL}/frontend/banner-slides`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur lors du chargement des slides:', error);
      throw error;
    }
  },

  // Récupérer les slides pour l'admin
  async getAdminBannerSlides() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/banner-slides`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur lors du chargement des slides (admin):', error);
      throw error;
    }
  },

  // Mettre à jour un slide
  async updateBannerSlide(index, data) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/banner-slide/${index}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur mise à jour slide:', error);
      throw error;
    }
  },

  // Ajouter un nouveau slide
  async addBannerSlide(data) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/banner-slide`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur ajout slide:', error);
      throw error;
    }
  },

  // Supprimer un slide
  async deleteBannerSlide(index) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/banner-slide/${index}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur suppression slide:', error);
      throw error;
    }
  },

  // Réorganiser les slides
  async reorderBannerSlides(slides) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/banner-slides/reorder`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ slides })
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur réorganisation slides:', error);
      throw error;
    }
  },

  // Fonction pour télécharger un média
  async downloadMedia(url, filename) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || 'media';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erreur téléchargement:', error);
    }
  },

  // Fonction pour partager un média
  async shareMedia(media) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: media.titre || 'Media',
          text: media.description || 'Partage de média',
          url: media.url
        });
        return { success: true };
      } catch (error) {
        console.error('Erreur partage:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Fallback: copier l'URL
      return {
        success: true,
        message: 'URL copiée dans le presse-papier',
        fallback: true
      };
    }
  },

  // Paramètres du site
  async getSettings() {
    try {
      const response = await fetch(`${API_BASE_URL}/frontend/settings`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur chargement paramètres:', error);
      throw error;
    }
  },

  async saveSetting(key, value) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cle: key, valeur: value })
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur sauvegarde paramètre:', error);
      throw error;
    }
  },

  async getLogo() {
    try {
      const response = await fetch(`${API_BASE_URL}/logo`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Erreur chargement logo:', error);
      throw error;
    }
  },

  async uploadLogo(formData) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/logo/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur upload logo:', error);
      throw error;
    }
  },

  async uploadHeroBackground(formData) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/settings/upload/hero-background`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      return await response.json();
    } catch (error) {
      console.error('Erreur upload hero background:', error);
      throw error;
    }
  },

  // Prévisualiser un média
  getMediaUrl(media) {
    if (media.url.startsWith('http')) {
      return media.url;
    } else {
      return `http://192.168.179.20:5005${media.url}`;
    }
  }
};

// Exporter les fonctions individuelles si nécessaire
export const getSettings = apiService.getSettings.bind(apiService);
export const saveSetting = apiService.saveSetting.bind(apiService);
export const getLogo = apiService.getLogo.bind(apiService);
export const uploadLogo = apiService.uploadLogo.bind(apiService);
export const uploadHeroBackground = apiService.uploadHeroBackground.bind(apiService);
export const downloadMedia = apiService.downloadMedia.bind(apiService);
export const shareMedia = apiService.shareMedia.bind(apiService);
export const getBannerSlides = apiService.getBannerSlides.bind(apiService);
export const getAdminBannerSlides = apiService.getAdminBannerSlides.bind(apiService);
export const updateBannerSlide = apiService.updateBannerSlide.bind(apiService);
export const addBannerSlide = apiService.addBannerSlide.bind(apiService);
export const deleteBannerSlide = apiService.deleteBannerSlide.bind(apiService);
export const reorderBannerSlides = apiService.reorderBannerSlides.bind(apiService);

// Export par défaut
export default apiService;