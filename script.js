new Vue({
  el: "#app",
  data: {
    map: null,
    bysat: "https://api.bysat.com.br",
    base: "https://laboratorio-python-fczdesenvolvime.replit.app", // URL base da API
    gerencias: [], // Armazena as gerências carregadas
    roteiros: [], // Armazena os roteiros carregados
    locais: [], // Armazena os locais carregados
    prefixos: [],
    tipos: [], // Armazena os tipos carregados
    listaLocais: [], // Armazena a lista completa de locais
    gerencia: null,
    roteiro: null,
    polilinhas: [],
    trechos: [],
    veiculo: null,
    data: null,
    inicio: null,
    fim: null,
    bearer: null,
  },
  watch: {
    trechos: function (n, o) {
      this.renderizarPolilinhas();
    },
  },
  mounted() {
    this.initMap();
    this.carregarGerencias();
    this.carregarLocais();
  },
  methods: {
    adicionarMarcador(latitude, longitude, nome, vetor) {
      // Cria um marcador usando as coordenadas fornecidas
      const marker = L.marker([latitude, longitude]).addTo(this.map);

      // Adiciona um popup ao marcador com o nome e vetor
      marker.bindPopup(`<b>${nome}</b><br>${vetor}`).openPopup();
    },
    buscarRoteiro() {
      this.limparMapa();

      const url = `${this.base}/marcadores/${this.gerencia}/${this.roteiro}`;

      axios
        .get(url)
        .then((response) => {
          const { status, data } = response;
          if (status === 200 || status === 201) {
            data.forEach((d) => {
              this.adicionarMarcador(
                parseFloat(d.latitude),
                parseFloat(d.longitude),
                d.nome,
                d.vetor
              );
            });
          }
        })
        .then(() => {
          const url = `${this.base}/coordenadas/${this.gerencia}/${this.roteiro}`;
          axios
            .get(url)
            .then((response) => {
              const { data, status } = response;
              if (status === 200 || status === 201) {
                data.forEach((d) => {
                  d.polilinha = this.decodificarOverwiewPolyline(d.polilinha);
                  this.polilinhas.push(d);
                });

                this.polilinhas.sort((a, b) => a.uid - b.uid);
                this.trechos = this.polilinhas.filter(
                  (x) => x.opcao === "coleta"
                );
                console.log(this.trechos);
              }
            })
            .catch((error) =>
              Swal.fire("Erro no servidor", error.message, "error")
            );
        })
        .catch((error) =>
          Swal.fire("Erro no servidor", error.message, "error")
        );
    },
    buscarTelemetria() {
      const roteiro = this.prefixos.filter((x) => x.roteiro === this.roteiro);
      const { inicio, fim } = roteiro[0];
      console.log(inicio, fim);

      this.inicio = `${this.data} ${inicio.toString().padStart(2, "0")}:00:00`;
      this.fim = `${this.data} ${fim.toString().padStart(2, "0")}:00:00`;

      const url = `${this.bysat}/getPosicaoTelemetria?id_veiculo=${this.veiculo}&periodo_inicio=${this.inicio}&periodo_fim=${this.fim}`;
      console.log(url);

      const config = {
        method: "get",
        url,
        headers: {
          Authorization: `Bearer ${this.bearer}`,
        },
      };

      axios(config)
        .then((response) => {
          console.log(response.data);
        })
        .catch((error) => {
          Swal.fire("Sucesso", error.message, "success");
        });
    },
    carregarGerencias() {
      fetch(`${this.base}/gerencias`)
        .then((response) => response.json())
        .then((data) => {
          const gerencias = new Set();
          data.forEach((item) => {
            gerencias.add(item.gerencia);
          });
          this.gerencias = Array.from(gerencias);
          this.roteiros = data;
        });
    },
    carregarLocais() {
      fetch(`${this.base}/locais`)
        .then((response) => response.json())
        .then((data) => {
          const tipos = new Set();
          const locais = new Set();
          data.forEach((item) => {
            locais.add({
              nome: item.nome,
              tipo: item.tipo,
            });
            tipos.add(item.tipo);
          });

          this.locais = Array.from(locais);
          this.tipos = Array.from(tipos);
        });
    },
    carregarLocais() {
      fetch(`${this.base}/roteiros`)
        .then((response) => response.json())
        .then((data) => {
          const prefixos = new Set();
          data.forEach((item) => {
            prefixos.add(item);
          });

          this.prefixos = Array.from(prefixos);
        });
    },
    decodificarOverwiewPolyline(encoded) {
      let index = 0,
        len = encoded.length;
      let lat = 0,
        lng = 0;
      const coordinates = [];

      while (index < len) {
        let b,
          shift = 0,
          result = 0;

        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);

        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;

        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);

        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        coordinates.push([lat * 1e-5, lng * 1e-5]);
      }

      return coordinates;
    },
    initMap() {
      this.map = L.map("map").setView([-22.9068, -43.1729], 13);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
        }
      ).addTo(this.map);
    },
    limparMapa() {
      this.map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          return; // Mantém a camada base
        }
        this.map.removeLayer(layer); // Remove outras camadas
      });
    },
    renderizarPolilinhas() {
      this.trechos.forEach((trecho) => {
        const polilinha = L.polyline(trecho.polilinha, {
          color: "red", // Cor fixa para a polilinha
          weight: 4, // Espessura da linha
          opacity: 0.8, // Opacidade da linha
        }).addTo(this.map);

        // Centralizar o mapa na primeira polilinha adicionada
        this.map.fitBounds(polilinha.getBounds());
      });
    },
    updateRoteiros() {
      this.roteiro = ""; // Reset the selected roteiro
    },
  },
  computed: {
    filteredRoteiros() {
      return this.roteiros
        .filter((item) => item.gerencia === this.gerencia)
        .map((item) => item.roteiro);
    },
    filteredLocais() {
      return this.locais
        .filter((item) => item.tipo === this.tipo)
        .map((item) => item);
    },
    filteredPrefixos() {
      const arr = new Set();

      const filter = this.prefixos.filter(
        (item) => item.gerencia === this.gerencia
      );

      filter.forEach((x) => {
        arr.add(x.prefixo);
      });

      return Array.from(arr);
    },
  },
});
